import React, { useRef, useState } from 'react'
import { message } from 'antd'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { chatWithDeepSeek, handleQuestionDetected } from '@/api/deepseek'
import { createRtasrWebSocket, parseRtasrResult, setAudioActiveState, cleanupQuestionDetection } from '@/api/xfyunRtasr'
import { useInterviewStore } from '@/store/interviewStore'
import { isAudioActive } from '@/utils/voiceIdentifier'
import { BrowserAudioRecorder } from '@/utils/browserAudioRecorder'
import { buildStableSystemPrompt } from '@/utils/questionDetection'

type AudioSource = 'meeting' | 'microphone'

const InterviewMeeting: React.FC = () => {
  const navigate = useNavigate()
  const addTransResult = useInterviewStore(s => s.addTransResult)
  const addMessage = useInterviewStore(s => s.addMessage)
  const upsertAnswer = useInterviewStore(s => s.upsertAnswer)
  const messages = useInterviewStore(s => s.messages)
  const answers = useInterviewStore(s => s.answers)
  const [recording, setRecording] = useState(false)
  const [audioActive, setAudioActive] = useState(false)
  const [manualQuestion, setManualQuestion] = useState('')
  const [recordingStatus, setRecordingStatus] = useState('未录音')
  const [audioSource, setAudioSource] = useState<AudioSource>('meeting')
  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<BrowserAudioRecorder | null>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const voiceContentRef = useRef<HTMLDivElement>(null)
  const frameCountRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  const aiDebounceRef = useRef<number | null>(null)
  const seenTranscriptRef = useRef<Set<string>>(new Set())
  const transcriptFlushTimerRef = useRef<number | null>(null)
  const pendingTranscriptRef = useRef<{
    role: 'user' | 'asker'
    content: string
  } | null>(null)

  const appendRecordingStatus = (status: string) => {
    setRecordingStatus(previous => `${previous} -> ${status}`)
  }

  const scheduleQuestionDetection = () => {
    if (aiDebounceRef.current) {
      window.clearTimeout(aiDebounceRef.current)
    }

    aiDebounceRef.current = window.setTimeout(() => {
      handleQuestionDetected()
      aiDebounceRef.current = null
    }, 1500)
  }

  const flushPendingTranscript = (triggerAI = true) => {
    if (transcriptFlushTimerRef.current) {
      window.clearTimeout(transcriptFlushTimerRef.current)
      transcriptFlushTimerRef.current = null
    }

    const pending = pendingTranscriptRef.current
    pendingTranscriptRef.current = null

    if (!pending?.content.trim()) {
      return
    }

    addMessage({
      content: pending.content.trim(),
      role: pending.role,
      status: 'sent',
    })

    if (triggerAI && pending.role === 'asker') {
      appendRecordingStatus('正在发送给 DeepSeek')
      window.setTimeout(() => {
        handleQuestionDetected()
      }, 50)
    }
  }

  const queueTranscriptMessages = (newMessages: Array<{ content: string; role: 'user' | 'asker' }>) => {
    newMessages.forEach((msg) => {
      const content = msg.content.trim()
      if (!content) return

      const pending = pendingTranscriptRef.current
      if (!pending || pending.role !== msg.role) {
        flushPendingTranscript(msg.role === 'asker')
        pendingTranscriptRef.current = {
          role: msg.role,
          content,
        }
        return
      }

      if (content.startsWith(pending.content)) {
        pending.content = content
      } else if (!pending.content.includes(content)) {
        pending.content = `${pending.content}${/[,.?!]$/.test(pending.content) ? '' : ' '}${content}`
      }
    })

    if (transcriptFlushTimerRef.current) {
      window.clearTimeout(transcriptFlushTimerRef.current)
    }

    transcriptFlushTimerRef.current = window.setTimeout(() => {
      flushPendingTranscript(true)
    }, 1800)
  }

  const handleRtasrResult = (data: any) => {
    if (data?.msg_type === 'action' && data?.data?.sessionId) {
      sessionIdRef.current = data.data.sessionId
      appendRecordingStatus('会话已就绪')
      return
    }

    if (data?.msg_type === 'result' && data?.res_type && data.res_type !== 'asr') {
      const errorText = data?.data?.desc || '实时转写失败'
      message.error(errorText)
      console.error('RTASR error:', data)
      return
    }

    if (data?.action && data.action !== 'result') return
    if (data?.msg_type && data.msg_type !== 'result') return

    if (data.code && data.code !== '0') {
      message.error(data.desc || '实时转写失败')
      console.error('RTASR error:', data)
      return
    }

    const parsedData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data
    addTransResult({
      action: data.action || data.msg_type || 'result',
      code: data.code || '0',
      data: parsedData,
      desc: data.desc,
      sid: data.sid || sessionIdRef.current || '',
    })

    const parsedMessages = parseRtasrResult(
      parsedData,
      undefined,
      audioSource === 'meeting' ? 'asker' : 'user',
    )
    const newMessages = parsedMessages.filter((msg) => {
      const key = `${msg.role}:${msg.content.trim()}`
      if (!msg.content.trim() || seenTranscriptRef.current.has(key)) {
        return false
      }
      seenTranscriptRef.current.add(key)
      return true
    })

    queueTranscriptMessages(newMessages)
  }

  const handleStart = async () => {
    try {
      setRecordingStatus('正在连接实时转写')
      frameCountRef.current = 0
      sessionIdRef.current = null
      seenTranscriptRef.current.clear()
      pendingTranscriptRef.current = null
      if (transcriptFlushTimerRef.current) {
        window.clearTimeout(transcriptFlushTimerRef.current)
        transcriptFlushTimerRef.current = null
      }
      setRecording(true)
      const recorder = new BrowserAudioRecorder()
      recorderRef.current = recorder

      const ws = createRtasrWebSocket({
        onResult: handleRtasrResult,
        onError: () => {
          setRecording(false)
          appendRecordingStatus('WebSocket 错误')
          message.error('实时转写连接失败，请检查讯飞配置和网络')
        },
        onClose: (event) => {
          setRecording(false)
          appendRecordingStatus(`closed ${event.code}${event.reason ? ` ${event.reason}` : ''}`)
          if (event.code !== 1000) {
            const reason = event.reason ? `: ${event.reason}` : ''
            message.warning(`RTASR connection closed (${event.code})${reason}`)
          }
        },
        onOpen: async () => {
          try {
            appendRecordingStatus('已打开')
            appendRecordingStatus(audioSource === 'meeting' ? '正在请求会议音频' : '正在请求麦克风')
            recorder.onFrameRecorded = ({ isLastFrame, frameBuffer }: any) => {
              frameCountRef.current += 1
              if (frameCountRef.current === 1) {
                appendRecordingStatus('第一帧音频')
              } else if (frameCountRef.current % 25 === 0) {
                setRecordingStatus(previous => `${previous.split(' | ')[0]} | frames: ${frameCountRef.current}`)
              }
              const active = isAudioActive(frameBuffer, 0.02)
              setAudioActive(active)
              setAudioActiveState(active)

              if (ws.readyState === ws.OPEN) {
                if (frameBuffer.byteLength > 0) {
                  ws.send(new Int8Array(frameBuffer))
                }
                if (isLastFrame) {
                  ws.send(JSON.stringify(sessionIdRef.current ? { end: true, sessionId: sessionIdRef.current } : { end: true }))
                }
              }
            }
            recorder.onStop = () => {}
            await recorder.start({ sampleRate: 16000, frameSize: 640, source: audioSource })
            appendRecordingStatus(audioSource === 'meeting' ? '会议音频已开始' : '麦克风已开始')
          } catch (err: any) {
            setRecording(false)
            const errorMessage = err?.message || (audioSource === 'meeting'
              ? '会议音频采集失败，请选择屏幕、窗口或标签页，并开启音频共享。'
              : '麦克风采集失败，请允许麦克风权限。')
            appendRecordingStatus(errorMessage)
            ws.close(4000, 'recorder-start-failed')
            message.error(errorMessage)
            console.error('Recorder start failed:', err)
          }
        },
      })
      wsRef.current = ws
    } catch (err: any) {
      setRecording(false)
      setRecordingStatus(err?.message || '启动实时转写失败')
      message.error(err?.message || '启动实时转写失败')
      console.error('开始面试 failed:', err)
    }
  }

  const handleStop = () => {
    setRecording(false)
    appendRecordingStatus('已停止')
    flushPendingTranscript(true)
    recorderRef.current?.stop()
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(sessionIdRef.current ? { end: true, sessionId: sessionIdRef.current } : { end: true }))
    }
    wsRef.current?.close()
    cleanupQuestionDetection()
    if (aiDebounceRef.current) {
      window.clearTimeout(aiDebounceRef.current)
      aiDebounceRef.current = null
    }
  }

  const handleSendInterviewerNow = () => {
    const hasPendingInterviewer = pendingTranscriptRef.current?.role === 'asker'
      && Boolean(pendingTranscriptRef.current.content.trim())
    const hasUnsentInterviewer = messages.some(msg => msg.role === 'asker' && !msg.isAsked)

    if (!hasPendingInterviewer && !hasUnsentInterviewer) {
      appendRecordingStatus('没有未发送的面试官文本')
      return
    }

    flushPendingTranscript(false)
    appendRecordingStatus('手动发送给 DeepSeek')
    window.setTimeout(() => {
      handleQuestionDetected()
    }, 80)
  }

  const handleManualSend = async () => {
    const content = manualQuestion.trim()
    if (!content) return

    addMessage({
      content,
      role: 'user',
      status: 'sent',
    })
    setManualQuestion('')

    try {
      const response = await chatWithDeepSeek([
        {
          role: 'system',
          content: buildStableSystemPrompt(),
        },
        {
          role: 'user',
          content,
        },
      ], { stream: false })
      const answer = response.choices?.[0]?.message?.content || ''

      if (!answer) {
        throw new Error('AI 返回为空')
      }

      upsertAnswer({
        id: response.id || `manual-${Date.now()}`,
        message: answer,
        created: Date.now(),
        question: content,
      })
    } catch (err: any) {
      message.error(err?.message || 'AI 请求失败')
      console.error('Manual question failed:', err)
    }
  }

  React.useEffect(() => {
    const handleAnswerCreated = () => {
      appendRecordingStatus('DeepSeek 已回答')
    }

    const handleAnswerFailed = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: string }>).detail
      appendRecordingStatus(`DeepSeek failed${detail?.reason ? `: ${detail.reason}` : ''}`)
    }

    window.addEventListener('deepseek-answer-created', handleAnswerCreated)
    window.addEventListener('deepseek-answer-failed', handleAnswerFailed)

    return () => {
      window.removeEventListener('deepseek-answer-created', handleAnswerCreated)
      window.removeEventListener('deepseek-answer-failed', handleAnswerFailed)
      cleanupQuestionDetection()
      if (aiDebounceRef.current) {
        window.clearTimeout(aiDebounceRef.current)
      }
      if (transcriptFlushTimerRef.current) {
        window.clearTimeout(transcriptFlushTimerRef.current)
      }
      recorderRef.current?.stop()
      wsRef.current?.close()
    }
  }, [])

  React.useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight
    }
  }, [answers])

  React.useEffect(() => {
    if (voiceContentRef.current) {
      voiceContentRef.current.scrollTop = voiceContentRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>
        <div
          ref={chatAreaRef}
          style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}
        >
          {answers.length > 0 ? answers.map((ans, idx) => (
            <div key={ans.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, minHeight: 'fit-content' }}>
              <div style={{ flex: 1, background: '#f5f5f5', borderRadius: 8, padding: 12, textAlign: 'left', maxWidth: '30%', minWidth: '200px' }}>
                <b>问：</b> {ans.question}
              </div>
              <div style={{ flex: 2, background: '#e6f7ff', borderRadius: 8, padding: 12, textAlign: 'left' }}>
                <b>答：</b> <ReactMarkdown>{ans.message}</ReactMarkdown>
              </div>
            </div>
          )) : (
            <div style={{ fontSize: 32, color: '#ddd', textAlign: 'center', margin: 'auto' }}>
              暂无答案
            </div>
          )}
        </div>

        <div style={{ width: 250, borderLeft: '1px solid #eee', padding: 16, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#666', flexShrink: 0 }}>现场文字记录</h3>
          <div ref={voiceContentRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {messages.map((msg, idx) => (
              <div key={msg.id || idx} style={{ marginBottom: 8, background: msg.role === 'user' ? '#f0f8ff' : '#f5f5f5', borderRadius: 8, padding: 8, fontSize: 12, lineHeight: 1.4 }}>
                <b style={{ color: msg.role === 'user' ? '#1677ff' : '#722ed1' }}>
                  {msg.role === 'user' ? '我' : '面试官'}:
                </b>{' '}
                {msg.content}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        height: '96px',
        borderTop: '1px solid #eee',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fff',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        <div style={{ width: 300, minWidth: 300, fontSize: 12, color: '#666', overflow: 'hidden' }}>
          帮助中心<br />
          <span
            title={recordingStatus}
            style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {recordingStatus}
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <input type="checkbox" />
            固定当前答案
          </label>
        </div>

        <div style={{ flex: 1, margin: '0 24px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <input
            style={{ flex: 1, minWidth: 220, height: 40, padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 4, fontSize: 14 }}
            placeholder="输入面试问题"
            value={manualQuestion}
            onChange={(event) => setManualQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                handleManualSend()
              }
            }}
          />
          <button
            style={{ width: 72, height: 40, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}
            onClick={handleManualSend}
          >
            发送
          </button>
          <select
            value={audioSource}
            disabled={recording}
            onChange={(event) => setAudioSource(event.target.value as AudioSource)}
            style={{ width: 136, height: 40, padding: '0 10px', border: '1px solid #d9d9d9', borderRadius: 4, background: '#fff', cursor: recording ? 'not-allowed' : 'pointer', fontSize: 14 }}
          >
            <option value="meeting">会议音频</option>
            <option value="microphone">麦克风</option>
          </select>
          <button style={{ width: 104, height: 40, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
            自定义提示词
          </button>
          <button
            style={{ width: 128, height: 40, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
            onClick={handleSendInterviewerNow}
          >
            发送面试官
          </button>
          <button style={{ width: 72, height: 40, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
            注释
          </button>
        </div>

        <div style={{ width: 300, minWidth: 300, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: recording ? (audioActive ? '#52c41a' : '#ff4d4f') : '#d9d9d9',
            }} />
            <span style={{ fontSize: 12, color: '#666' }}>
              {recording ? (audioActive ? '录音中' : '静音') : '未录音'}
            </span>
          </div>

          <button
            style={{ width: 112, height: 48, background: recording ? '#ff4d4f' : '#1677ff', color: '#fff', padding: '0 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
            onClick={recording ? handleStop : handleStart}
          >
            {recording ? '停止录音' : '开始面试'}
          </button>

          <button
            style={{ width: 72, height: 48, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 14 }}
            onClick={() => navigate('/interview/new')}
          >
            返回
          </button>
        </div>
      </div>
    </div>
  )
}

export default InterviewMeeting
