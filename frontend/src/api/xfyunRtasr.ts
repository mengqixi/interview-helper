import CryptoJS from 'crypto-js'
import type { MeetingMessage } from '@/store/interviewStore'
import { useXfyunConfigStore } from '@/store/xfyunConfigStore'

const RTASR_LLM_URL = 'wss://office-api-ast-dx.iflyaisol.com/ast/communicate/v1'

function getBeijingUtcString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+0800`
}

function getUuid() {
  if (crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now()}${Math.random().toString(16).slice(2)}`.slice(0, 32)
}

function encodeParams(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .filter(key => params[key] !== undefined && params[key] !== null && String(params[key]).trim() !== '')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
}

function signParams(params: Record<string, string>, apiSecret: string) {
  const baseString = encodeParams(params)
  const signatureSha = CryptoJS.HmacSHA1(baseString, apiSecret)
  return CryptoJS.enc.Base64.stringify(signatureSha)
}

export function getRtasrWebSocketUrl() {
  const { getAppId, getApiKey, getApiSecret } = useXfyunConfigStore.getState()
  const appId = getAppId()
  const apiKey = getApiKey()
  const apiSecret = getApiSecret()

  if (!appId || !apiKey || !apiSecret) {
    throw new Error('Xfyun realtime ASR is not configured. Set AppID, API Key, and API Secret in settings.')
  }

  const params: Record<string, string> = {
    accessKeyId: apiKey,
    appId,
    uuid: getUuid(),
    utc: getBeijingUtcString(),
    audio_encode: 'pcm_s16le',
    lang: 'autodialect',
    samplerate: '16000',
  }
  params.signature = signParams(params, apiSecret)

  return `${RTASR_LLM_URL}?${new URLSearchParams(params).toString()}`
}

export function createRtasrWebSocket({
  onResult,
  onError,
  onOpen,
  onClose,
}: {
  onResult: (data: any) => void
  onError?: (event: Event) => void
  onOpen?: () => void
  onClose?: (event: CloseEvent) => void
}) {
  const ws = new WebSocket(getRtasrWebSocketUrl())

  ws.onopen = () => {
    console.info('RTASR LLM WebSocket opened')
    onOpen?.()
  }

  ws.onmessage = (event) => {
    try {
      const json = JSON.parse(event.data)
      console.info('RTASR LLM WebSocket message:', json)
      onResult(json)
    } catch {
      console.info('RTASR LLM WebSocket non-JSON message:', event.data)
    }
  }

  ws.onerror = (event) => {
    console.error('RTASR LLM WebSocket error:', event)
    onError?.(event)
  }

  ws.onclose = (event) => {
    console.warn('RTASR LLM WebSocket closed:', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    })
    onClose?.(event)
  }

  return ws
}

let questionDetectionDebouncer: any = null
let lastDataReceiveTime = Date.now()
let currentQuestionDetectionCallback: (() => void) | null = null
let silenceCheckTimer: number | null = null

export function cleanupQuestionDetection() {
  if (silenceCheckTimer) {
    window.clearTimeout(silenceCheckTimer)
    silenceCheckTimer = null
  }

  currentQuestionDetectionCallback = null

  if (questionDetectionDebouncer) {
    questionDetectionDebouncer.destroy?.()
    questionDetectionDebouncer = null
  }
}

async function initDebouncer() {
  if (!questionDetectionDebouncer) {
    const { QuestionDetectionDebouncer } = await import('@/utils/questionDetection')
    questionDetectionDebouncer = new QuestionDetectionDebouncer(500)
  }
  return questionDetectionDebouncer
}

export async function setAudioActiveState(audioActive: boolean) {
  const { updateAudioActiveState } = await import('@/utils/questionDetection')
  updateAudioActiveState(audioActive)

  if (!audioActive && currentQuestionDetectionCallback) {
    if (silenceCheckTimer) {
      window.clearTimeout(silenceCheckTimer)
    }

    silenceCheckTimer = window.setTimeout(() => {
      checkAndTriggerQuestionDetection(currentQuestionDetectionCallback || undefined, true)
      silenceCheckTimer = null
    }, 1100)
  } else if (audioActive && silenceCheckTimer) {
    window.clearTimeout(silenceCheckTimer)
    silenceCheckTimer = null
  }
}

function shouldPreCheck(lastDataTime: number): boolean {
  return Date.now() - lastDataTime > 2500
}

async function checkAndTriggerQuestionDetection(onQuestionDetection?: () => void, bypassPreCheck = false) {
  if (!onQuestionDetection) return

  if (!bypassPreCheck && !shouldPreCheck(lastDataReceiveTime)) {
    return
  }

  const { shouldTriggerQuestionDetection } = await import('@/utils/questionDetection')
  if (!shouldTriggerQuestionDetection(lastDataReceiveTime)) {
    return
  }

  const debouncer = await initDebouncer()
  debouncer.debounce(onQuestionDetection)
}

function getRtasrData(contentData: any) {
  if (typeof contentData?.data === 'string') {
    try {
      return JSON.parse(contentData.data)
    } catch {
      return null
    }
  }

  if (contentData?.data?.cn?.st) {
    return contentData.data
  }

  if (contentData?.cn?.st) {
    return contentData
  }

  return null
}

export function parseRtasrResult(
  contentData: any,
  onQuestionDetected?: () => void,
  roleOverride?: 'user' | 'asker',
): MeetingMessage[] {
  const result: MeetingMessage[] = []
  const data = getRtasrData(contentData)

  if (!data) {
    return result
  }

  lastDataReceiveTime = Date.now()

  if (onQuestionDetected) {
    currentQuestionDetectionCallback = onQuestionDetected
  }

  try {
    const rt = data?.cn?.st?.rt
    if (!Array.isArray(rt) || data?.cn?.st?.type !== '0') {
      return result
    }

    let lastRl: string | null = null
    let currentContent = ''
    let currentRole: 'user' | 'asker' = 'user'

    rt.forEach((rtItem: any) => {
      rtItem.ws?.forEach((wsItem: any) => {
        wsItem.cw?.forEach((cwItem: any) => {
          const rl = String(cwItem.rl ?? lastRl ?? '0')
          const role: 'user' | 'asker' = roleOverride || (rl === '0' || rl === '1' ? 'user' : 'asker')

          if (lastRl === null) {
            lastRl = rl
            currentRole = role
            currentContent = cwItem.w || ''
            return
          }

          if (rl === lastRl) {
            currentContent += cwItem.w || ''
            return
          }

          if (currentContent.trim()) {
            result.push({
              id: `${Date.now()}${Math.random()}`,
              timestamp: Date.now(),
              content: currentContent.trim(),
              role: currentRole,
              status: 'sent',
            })
            checkAndTriggerQuestionDetection(onQuestionDetected)
          }

          lastRl = rl
          currentRole = role
          currentContent = cwItem.w || ''
        })
      })
    })

    if (currentContent.trim()) {
      result.push({
        id: `${Date.now()}${Math.random()}`,
        timestamp: Date.now(),
        content: currentContent.trim(),
        role: currentRole,
        status: 'sent',
      })
      checkAndTriggerQuestionDetection(onQuestionDetected)
    }

    return result
  } catch (error) {
    console.error('parseRtasrResult error:', error)
    return result
  }
}
