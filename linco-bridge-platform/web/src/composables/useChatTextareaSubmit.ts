import { ref } from 'vue'

/** Enter to send, Shift+Enter to newline — aligned with Flutter ChatInputTextField. */
export function useChatTextareaSubmit(canSubmit: () => boolean, onSend: () => void) {
  const isComposing = ref(false)

  function onCompositionStart() {
    isComposing.value = true
  }

  function onCompositionEnd() {
    isComposing.value = false
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
    if (isComposing.value) return

    event.preventDefault()
    if (!canSubmit()) return
    onSend()
  }

  return {
    isComposing,
    onCompositionStart,
    onCompositionEnd,
    onKeydown,
  }
}
