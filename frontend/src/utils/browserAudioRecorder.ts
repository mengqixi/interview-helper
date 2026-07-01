type AudioSource = 'microphone' | 'meeting'

interface StartOptions {
  sampleRate: number
  frameSize: number
  source: AudioSource
}

interface FrameRecordedEvent {
  isLastFrame: boolean
  frameBuffer: ArrayBuffer
}

export class BrowserAudioRecorder {
  onFrameRecorded?: (event: FrameRecordedEvent) => void
  onStop?: () => void
  onStart?: () => void

  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private processorNode: ScriptProcessorNode | null = null
  private sampleBuffer: number[] = []
  private stopped = true
  private targetSampleRate = 16000
  private frameSize = 640

  async start(options: StartOptions) {
    this.stop()
    this.stopped = false
    this.sampleBuffer = []
    this.targetSampleRate = options.sampleRate
    this.frameSize = options.frameSize

    this.stream = await this.createStream(options.source)
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    this.audioContext = new AudioContextCtor()
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream)
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1)

    this.processorNode.onaudioprocess = (event) => {
      if (this.stopped) return

      const input = event.inputBuffer.getChannelData(0)
      const resampled = this.resample(input, this.audioContext?.sampleRate || this.targetSampleRate)
      this.sampleBuffer.push(...resampled)
      this.flushFrames(false)
    }

    this.sourceNode.connect(this.processorNode)
    this.processorNode.connect(this.audioContext.destination)
    await this.audioContext.resume()
    this.onStart?.()
  }

  stop() {
    if (this.stopped) return

    this.stopped = true
    this.flushFrames(true)
    this.processorNode?.disconnect()
    this.sourceNode?.disconnect()
    this.stream?.getTracks().forEach(track => track.stop())
    this.audioContext?.close()
    this.processorNode = null
    this.sourceNode = null
    this.stream = null
    this.audioContext = null
    this.onStop?.()
  }

  private async createStream(source: AudioSource) {
    if (source === 'microphone') {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      })
    }

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })

    if (displayStream.getAudioTracks().length === 0) {
      displayStream.getTracks().forEach(track => track.stop())
      throw new Error('No meeting audio was shared. Select a screen/window/tab and enable audio sharing.')
    }

    return displayStream
  }

  private resample(input: Float32Array, fromSampleRate: number) {
    if (fromSampleRate === this.targetSampleRate) {
      return Array.from(input)
    }

    const ratio = fromSampleRate / this.targetSampleRate
    const outputLength = Math.floor(input.length / ratio)
    const output = new Array<number>(outputLength)

    for (let index = 0; index < outputLength; index += 1) {
      const sourceIndex = index * ratio
      const lower = Math.floor(sourceIndex)
      const upper = Math.min(lower + 1, input.length - 1)
      const weight = sourceIndex - lower
      output[index] = input[lower] * (1 - weight) + input[upper] * weight
    }

    return output
  }

  private flushFrames(isLastFrame: boolean) {
    while (this.sampleBuffer.length >= this.frameSize) {
      const samples = this.sampleBuffer.splice(0, this.frameSize)
      this.onFrameRecorded?.({
        isLastFrame: false,
        frameBuffer: this.toPcm16(samples),
      })
    }

    if (isLastFrame && this.sampleBuffer.length > 0) {
      const samples = this.sampleBuffer.splice(0, this.sampleBuffer.length)
      this.onFrameRecorded?.({
        isLastFrame: true,
        frameBuffer: this.toPcm16(samples),
      })
    } else if (isLastFrame) {
      this.onFrameRecorded?.({
        isLastFrame: true,
        frameBuffer: new ArrayBuffer(0),
      })
    }
  }

  private toPcm16(samples: number[]) {
    const pcm = new Int16Array(samples.length)
    samples.forEach((sample, index) => {
      const clipped = Math.max(-1, Math.min(1, sample))
      pcm[index] = clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff
    })
    return pcm.buffer
  }
}
