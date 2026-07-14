import { describe, expect, it } from 'vitest'
import {
  CodexHostDirectiveStreamFilter,
  sanitizeCodexHostDirectives,
} from './codex-host-directive'
import {
  isBridgeAttachmentOutboundNotice,
  sanitizeBridgeAssistantContent,
  stripBridgeAttachmentOutboundNotice,
} from './bridge-message-sanitize'

describe('codex-host-directive', () => {
  it('removes standalone Codex host directives', () => {
    const input =
      '提交完成。\n\n' +
      '::git-stage{cwd="/workspace"}\n' +
      '::git-commit{cwd="/workspace"}\n' +
      '::git-push{cwd="/workspace" branch="master"}'

    expect(sanitizeCodexHostDirectives(input)).toBe('提交完成。')
  })

  it('holds a split host directive without leaking its separators', () => {
    const filter = new CodexHostDirectiveStreamFilter()
    const output =
      filter.add('提交并推送完成。\n\n::git-pu') +
      filter.add('sh{cwd="/workspace" branch="master"}') +
      filter.close()

    expect(output).toBe('提交并推送完成。')
  })
})

describe('bridge-message-sanitize', () => {
  it('strips bridge attachment outbound notice prefix', () => {
    const notice =
      '📎 已处理 2 个附件：图片与文档将直接发送给当前 Agent 识别'
    const input = `${notice}\n\n## 分析结果`
    expect(stripBridgeAttachmentOutboundNotice(input)).toBe('## 分析结果')
    expect(isBridgeAttachmentOutboundNotice(notice)).toBe(true)
  })

  it('applies codex directive cleanup only for codex agent type', () => {
    const input = '完成。\n::git-push{cwd="/workspace"}'
    expect(sanitizeBridgeAssistantContent(input, { agentType: 'codex' })).toBe('完成。')
    expect(sanitizeBridgeAssistantContent(input, { agentType: 'claude' })).toBe(input)
  })
})
