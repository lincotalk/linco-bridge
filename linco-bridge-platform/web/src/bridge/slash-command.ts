export interface SlashCommandItem {
  command: string
  label?: string
  title: string
  description: string
  appendSpaceOnSelect?: boolean
  aliases?: string[]
}

export function slashCommandDisplayCommand(item: SlashCommandItem): string {
  return item.label?.trim() || item.command
}

function firstString(map: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = map[key]
    if (value == null) continue
    const text = String(value).trim()
    if (text) return text
  }
  return ''
}

export function slashCommandsFromHelpPayload(payload: unknown): SlashCommandItem[] {
  if (!payload || typeof payload !== 'object') return []
  const map = payload as Record<string, unknown>
  const rawItems = map.items
  if (!Array.isArray(rawItems)) return []

  const commands: SlashCommandItem[] = []
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue
    const itemMap = raw as Record<string, unknown>
    const command = firstString(itemMap, ['command', 'name', 'id'])
    if (!command.startsWith('/')) continue

    const label = firstString(itemMap, ['label'])
    const title = firstString(itemMap, ['title', 'label', 'command'])
    const description = firstString(itemMap, ['description', 'summary', 'title'])
    const displayLabel = label || command
    const hasPlaceholder = displayLabel.includes('<') || displayLabel.includes('[')
    const appendSpaceOnSelect =
      itemMap.append_space_on_select === true || hasPlaceholder

    commands.push({
      command,
      label: displayLabel !== command ? displayLabel : undefined,
      title: title || command,
      description: description || title || command,
      appendSpaceOnSelect,
    })
  }

  return commands
}

export function filterSlashCommands(
  commands: SlashCommandItem[],
  query: string,
): SlashCommandItem[] {
  const normalized = query.trim()
  if (!normalized.startsWith('/')) return []
  return commands.filter((item) => matchesSlashCommandQuery(item, normalized))
}

function matchesSlashCommandQuery(item: SlashCommandItem, normalized: string): boolean {
  if (item.command.startsWith(normalized)) return true
  if (slashCommandDisplayCommand(item).startsWith(normalized)) return true
  if (item.aliases?.some((alias) => alias.startsWith(normalized))) return true

  const command = item.command
  const spaceIndex = command.indexOf(' ')
  if (spaceIndex <= 0) return false
  const base = command.slice(0, spaceIndex)
  if (!normalized.startsWith(`${base} `)) return false
  const typedSuffix = normalized.slice(spaceIndex + 1)
  if (!typedSuffix) return true
  const optionsPart = command.slice(spaceIndex + 1)
  return optionsPart.split('/').some((option) => option.startsWith(typedSuffix))
}
