import { CANDIDATE_CONTEXT } from '@/data/candidateContext'
import type { Answer, MeetingMessage } from '../store/interviewStore'

export const getRecentMessages = (
  messages: MeetingMessage[],
  timeWindow = 30000,
  countWindow = 30
): MeetingMessage[] => {
  const now = Date.now()
  const timeFiltered = messages.filter(message => now - message.timestamp <= timeWindow)
  const countFiltered = messages.slice(-countWindow)
  return timeFiltered.length <= countFiltered.length ? timeFiltered : countFiltered
}

const readInterviewContext = () => {
  const params = new URLSearchParams(window.location.search)
  return {
    region: params.get('region') || 'Simplified Chinese',
    job: params.get('job') || 'Computer / AI related role',
    lang: params.get('lang') || 'General programming language',
  }
}

export const buildStableSystemPrompt = () => {
  const { region, job, lang } = readInterviewContext()
  return `You are a senior AI and software engineering interview assistant.

Interview context:
- Candidate role: ${job}
- Primary programming language or stack: ${lang}
- Answer language/region: ${region}

Candidate context:
${CANDIDATE_CONTEXT}

Task:
- Detect the newest interviewer question from the latest transcript messages.
- Answer the newest question directly, professionally, and in Simplified Chinese unless the transcript clearly asks for another language.
- Be concise and interview-ready: no preface, no apology, no restating the question.
- Prefer computer science and AI terminology: data structures, algorithms, complexity, OS, networking, databases, distributed systems, ML/deep learning, LLM/RAG/agents, frontend/backend engineering, and system design where relevant.
- Include only the most important trade-offs or implementation details.
- Keep the answer short: usually 1 short paragraph or at most 3 bullet points.
- If it is a concept question, use definition + key point + project connection. Do not expand into a long tutorial.
- If the transcript is noise or not a question, do not invent a long answer; provide a short clarification or the most likely interview-oriented response.
- Use the candidate context naturally when it helps, especially for project, resume, AI engineering, backend, security, networking, mobile, or realtime communication questions.
- Use the conversation history to understand what the interviewer already asked, what the candidate already answered, and what AI suggestions were already given. Do not repeat old answers unless the newest question asks for refinement.
- Do not reveal private contact details.`
}

const buildTranscriptHistory = (messages: MeetingMessage[], excludeIds: string[] = []) => {
  return messages
    .filter(message => message.role === 'asker' && !excludeIds.includes(message.id))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-4)
    .map(message => ({
      role: 'user' as const,
      content: `[interviewer transcript] ${message.content}`,
    }))
}

export const prepareMessagesForAI = (messages: MeetingMessage[], answers: Answer[] = []) => {
  void answers
  const recentMessages = getRecentMessages(messages, 10 * 60 * 1000, 12)
  const interviewerMessages = recentMessages.filter(message => message.role === 'asker')
  const newMessages = interviewerMessages.filter(message => !message.isAsked)

  if (newMessages.length === 0) {
    return { aiMessages: [], newMessageIds: [] }
  }

  const stablePrefix = [
    {
      role: 'system' as const,
      content: buildStableSystemPrompt(),
    },
  ]

  const newMessageIds = newMessages.map(message => message.id)
  const transcriptHistory = buildTranscriptHistory(messages, newMessageIds)

  const sortedNewMessages = newMessages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(message => ({
      role: 'user' as const,
      content: `[new interviewer transcript] ${message.content}`,
    }))

  return {
    aiMessages: [
      ...stablePrefix,
      ...transcriptHistory,
      ...sortedNewMessages,
    ],
    newMessageIds,
  }
}

export const prepareManualQuestionForAI = (
  content: string,
  messages: MeetingMessage[],
  answers: Answer[] = [],
) => {
  void answers
  return [
    {
      role: 'system' as const,
      content: buildStableSystemPrompt(),
    },
    ...buildTranscriptHistory(messages),
    {
      role: 'user' as const,
      content: `[manual question from candidate]\n${content}`,
    },
  ]
}

let silenceStartTime: number | null = null

export const updateAudioActiveState = (audioActive: boolean) => {
  if (audioActive) {
    silenceStartTime = null
  } else if (silenceStartTime === null) {
    silenceStartTime = Date.now()
  }
}

export const shouldTriggerQuestionDetection = (_lastDataTime: number): boolean => {
  return true
}

export class QuestionDetectionDebouncer {
  private timer: number | null = null
  private readonly delay: number

  constructor(delay = 500) {
    this.delay = delay
  }

  debounce(callback: () => void): void {
    if (this.timer) {
      clearTimeout(this.timer)
    }

    this.timer = window.setTimeout(() => {
      callback()
      this.timer = null
    }, this.delay)
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  destroy(): void {
    this.cancel()
  }
}
