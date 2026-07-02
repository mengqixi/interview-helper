import { message as antdMessage } from 'antd'
import { useInterviewStore } from '@/store/interviewStore'
import { useApiConfigStore } from '../store/apiConfigStore'

interface DeepSeekResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface DeepSeekRequest {
  model: string
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000').replace(/\/$/, '')

const getDeepSeekConfig = () => {
  const { apiConfigs } = useApiConfigStore.getState()
  const config = apiConfigs.find(item => item.apiProvider === 'deepseek')
  if (!config) {
    throw new Error('DeepSeek configuration not found')
  }
  return config
}

const readErrorMessage = async (response: Response) => {
  try {
    const data = await response.json()
    if (typeof data?.detail === 'string') {
      try {
        const providerError = JSON.parse(data.detail)
        return providerError?.error?.message || providerError?.message || data.detail
      } catch {
        return data.detail
      }
    }
    return data?.error?.message || data?.message || `HTTP error! status: ${response.status}`
  } catch {
    return `HTTP error! status: ${response.status}`
  }
}

const buildRequestBody = (
  messages: DeepSeekRequest['messages'],
  options?: {
    temperature?: number
    max_tokens?: number
    stream?: boolean
  }
) => {
  const config = getDeepSeekConfig()
  return {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl || 'https://api.deepseek.com',
    model: config.model || 'deepseek-chat',
    messages,
    temperature: options?.temperature ?? config.temperature,
    max_tokens: options?.max_tokens ?? config.maxTokens,
    stream: options?.stream ?? false,
  }
}

let questionRequestInFlight = false
let questionRequestQueued = false

export const chatWithDeepSeek = async (
  messages: DeepSeekRequest['messages'],
  options?: {
    temperature?: number
    max_tokens?: number
    stream?: boolean
  }
): Promise<DeepSeekResponse> => {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE_URL}/api/ai/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(buildRequestBody(messages, options)),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return await response.json()
}

export const streamChatWithDeepSeek = async (
  messages: DeepSeekRequest['messages'],
  onMessage: (parsed: any) => void,
  options?: {
    temperature?: number
    max_tokens?: number
  }
): Promise<void> => {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE_URL}/api/ai/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(buildRequestBody(messages, { ...options, stream: true })),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue

      try {
        onMessage(JSON.parse(data))
      } catch {
        // Ignore malformed SSE chunks.
      }
    }
  }
}

export const handleQuestionDetected = async () => {
  if (questionRequestInFlight) {
    questionRequestQueued = true
    return
  }

  questionRequestInFlight = true

  try {
    const store = useInterviewStore.getState()
    const { upsertAnswer, markMessagesAsAsked, messages, answers } = store
    const { prepareMessagesForAI } = await import('../utils/questionDetection')
    const { aiMessages, newMessageIds } = prepareMessagesForAI(messages, answers)

    if (aiMessages.length === 0 || newMessageIds.length === 0) {
      return
    }

    const response = await chatWithDeepSeek(aiMessages, { stream: false })
    const answer = response.choices?.[0]?.message?.content || ''

    if (!answer) {
      throw new Error('AI response was empty')
    }

    upsertAnswer({
      id: response.id || `deepseek-${Date.now()}`,
      message: answer,
      created: Date.now(),
      question: newMessageIds.map(id =>
        messages.find(item => item.id === id)?.content || ''
      ).join(' '),
    })

    markMessagesAsAsked(newMessageIds)
    window.dispatchEvent(new CustomEvent('deepseek-answer-created', {
      detail: { questionCount: newMessageIds.length },
    }))
  } catch (err: any) {
    const reason = err?.message || 'AI request failed'
    window.dispatchEvent(new CustomEvent('deepseek-answer-failed', {
      detail: { reason },
    }))
    antdMessage.error(reason)
    console.error('DeepSeek API Error:', err)
  } finally {
    questionRequestInFlight = false
    if (questionRequestQueued) {
      questionRequestQueued = false
      window.setTimeout(() => {
        handleQuestionDetected()
      }, 0)
    }
  }
}

export const handleQuestionEnd = handleQuestionDetected
