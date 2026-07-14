import type { AgentBridgeType } from '@/bridge/types'
import { CodexHostDirectiveStreamFilter, sanitizeCodexHostDirectives } from './codex-host-directive'

const BRIDGE_ATTACHMENT_OUTBOUND_NOTICE =
  /^\s*📎\s*已处理\s*\d+\s*个附件：\s*[^\r\n]*?将直接发送给当前\s*Agent\s*(?:识别|读取|处理)/

export function bridgeAttachmentOutboundNoticePrefix(text: string): string | null {
  const match = BRIDGE_ATTACHMENT_OUTBOUND_NOTICE.exec(text)
  return match?.[0] ?? null
}

export function stripBridgeAttachmentOutboundNotice(text: string): string {
  const prefix = bridgeAttachmentOutboundNoticePrefix(text)
  if (!prefix) return text
  return text.slice(prefix.length).replace(/^\s+/, '')
}

export function isBridgeAttachmentOutboundNotice(text: string): boolean {
  return bridgeAttachmentOutboundNoticePrefix(text) !== null
}

export function sanitizeBridgeAssistantContent(
  text: string,
  options?: { agentType?: AgentBridgeType | string | null },
): string {
  let cleaned = stripBridgeAttachmentOutboundNotice(text)
  if (options?.agentType === 'codex') {
    cleaned = sanitizeCodexHostDirectives(cleaned)
  }
  return cleaned
}

export class BridgeStreamContentSanitizer {
  private readonly codexFilter: CodexHostDirectiveStreamFilter | null

  constructor(bridgeType: string) {
    this.codexFilter = bridgeType === 'codex' ? new CodexHostDirectiveStreamFilter() : null
  }

  addChunk(value: string): string {
    let cleaned = stripBridgeAttachmentOutboundNotice(value)
    if (this.codexFilter) {
      cleaned = this.codexFilter.add(cleaned)
    }
    return cleaned
  }

  close(): string {
    return this.codexFilter?.close() ?? ''
  }

  reset(): void {
    this.codexFilter?.reset()
  }
}

export function sanitizeAssistantMessages(
  messages: Array<{ role: string; content: string }>,
  agentType?: AgentBridgeType | null,
) {
  return messages.map((message) =>
    message.role === 'assistant'
      ? {
          ...message,
          content: sanitizeBridgeAssistantContent(message.content, { agentType }),
        }
      : message,
  )
}
