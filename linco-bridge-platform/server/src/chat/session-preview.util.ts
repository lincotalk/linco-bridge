export function normalizeSessionPreview(content: string): string {
  let text = content.trim()
  if (!text) return ''

  text = text.replace(/\r\n/g, '\n')
  text = text.replace(/```[\s\S]*?```/g, '[代码]')
  text = text.replace(/`([^`\n]+)`/g, '$1')
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  text = text.replace(/\n+/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()

  if (text.length > 120) {
    return `${text.slice(0, 119)}…`
  }

  return text
}
