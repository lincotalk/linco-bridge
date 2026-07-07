import { showToast } from '@/utils/format'

type SpeechRecognitionCtor = new () => {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null
  onerror: (() => void) | null
  start: () => void
}

export function useVoiceInput(onText: (text: string) => void) {
  function startVoice() {
    if (typeof window === 'undefined') {
      showToast('当前平台暂不支持语音输入')
      return
    }

    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!SpeechRecognition) {
      showToast('当前浏览器不支持语音输入')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim() ?? ''
      if (text) onText(text)
    }
    recognition.onerror = () => {
      showToast('语音识别失败')
    }
    recognition.start()
    showToast('请开始说话…')
  }

  return { startVoice }
}
