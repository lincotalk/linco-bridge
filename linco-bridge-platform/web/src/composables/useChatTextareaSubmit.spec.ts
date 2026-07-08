import { describe, expect, it, vi } from 'vitest'
import { useChatTextareaSubmit } from '@/composables/useChatTextareaSubmit'

describe('useChatTextareaSubmit', () => {
  it('sends on Enter without shift', () => {
    const onSend = vi.fn()
    const { onKeydown } = useChatTextareaSubmit(() => true, onSend)

    const event = {
      key: 'Enter',
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent

    onKeydown(event)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('does not send on Shift+Enter', () => {
    const onSend = vi.fn()
    const { onKeydown } = useChatTextareaSubmit(() => true, onSend)

    onKeydown({
      key: 'Enter',
      shiftKey: true,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent)

    expect(onSend).not.toHaveBeenCalled()
  })
})
