import type { AgentHistoryItem } from '@/bridge/types'
import { formatSessionPreview } from '@/utils/format'

export function resolveAgentHistoryPreviewText(
  item: Pick<AgentHistoryItem, 'preview' | 'working'>,
  emptyLabel = '暂无消息',
): string {
  if (item.working) {
    const normalized = formatSessionPreview(item.preview)
    if (normalized.startsWith('正在')) return normalized
    return '正在回复...'
  }
  return formatSessionPreview(item.preview) || emptyLabel
}
