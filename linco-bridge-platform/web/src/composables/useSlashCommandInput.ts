import { computed, ref, type Ref } from 'vue'
import {
  filterSlashCommands,
  type SlashCommandItem,
} from '@/bridge/slash-command'

export function extractTextareaInputMeta(event: InputEvent): { value: string; cursor: number } {
  const detail = (event as unknown as { detail?: { value?: string; cursor?: number } }).detail
  const target = event.target as HTMLTextAreaElement | null
  const value = detail?.value ?? target?.value ?? ''
  const cursor =
    typeof detail?.cursor === 'number'
      ? detail.cursor
      : typeof target?.selectionStart === 'number'
        ? target.selectionStart
        : value.length
  return { value, cursor }
}

export function resolveSlashQuery(text: string, cursor?: number): string | null {
  const safeCursor = Math.max(0, Math.min(cursor ?? text.length, text.length))
  const beforeCursor = text.slice(0, safeCursor)
  if (!beforeCursor.startsWith('/') || beforeCursor.includes('\n')) return null
  return beforeCursor
}

export function useSlashCommandInput(
  draft: Ref<string>,
  commands: Ref<SlashCommandItem[]>,
) {
  const slashQuery = ref<string | null>(null)

  function updateSlashQuery(text: string, cursor?: number) {
    if (commands.value.length === 0) {
      slashQuery.value = null
      return
    }
    slashQuery.value = resolveSlashQuery(text, cursor)
  }

  const suggestions = computed(() => {
    if (!slashQuery.value) return []
    return filterSlashCommands(commands.value, slashQuery.value)
  })

  function applyCommand(item: SlashCommandItem): string {
    const text =
      item.appendSpaceOnSelect && !item.command.endsWith(' ')
        ? `${item.command} `
        : item.command
    draft.value = text
    slashQuery.value = resolveSlashQuery(text, text.length)
    return text
  }

  return {
    slashQuery,
    suggestions,
    updateSlashQuery,
    applyCommand,
  }
}
