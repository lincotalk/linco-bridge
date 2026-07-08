import type { ChatSessionRow } from '../src/database/database.service'
import {
  deduplicateBridgeHistorySessions,
  isBridgeProjectOnlyGeneratedTitle,
  resolveAgentHistoryPreview,
  resolveAgentHistoryTitle,
} from '../src/chat/agent-history-list.util'

function row(partial: Partial<ChatSessionRow> & Pick<ChatSessionRow, 'id'>): ChatSessionRow {
  return {
    id: partial.id,
    agent_type: partial.agent_type ?? 'codex',
    title: partial.title ?? 'Codex',
    bridge_connection_id: partial.bridge_connection_id ?? 'conn-1',
    bridge_project_path: partial.bridge_project_path ?? null,
    bridge_agent_session_id: partial.bridge_agent_session_id ?? null,
    bridge_device_name: partial.bridge_device_name ?? null,
    last_message: partial.last_message ?? '',
    update_time: partial.update_time ?? 1,
    is_temp_session: partial.is_temp_session ?? 0,
  }
}

describe('agent-history-list.util', () => {
  it('detects project-only generated titles', () => {
    expect(
      isBridgeProjectOnlyGeneratedTitle(
        row({
          id: 's1',
          bridge_project_path: 'D:\\project\\demo',
          title: 'demo',
        }),
      ),
    ).toBe(true)
  })

  it('resolves project-only title from first user message', () => {
    const title = resolveAgentHistoryTitle(
      row({
        id: 's1',
        bridge_project_path: 'D:\\project\\demo',
        title: 'demo',
      }),
      'HQ-TS-0182',
      '调整设置页推理与模型',
    )
    expect(title).toBe('调整设置页推理与模型')
  })

  it('prefers assistant preview over placeholder last message', () => {
    const preview = resolveAgentHistoryPreview(
      row({ id: 's1', last_message: 'Ready when you are.' }),
      '我会先按本会话的技能要求加载基础工作流说明',
    )
    expect(preview).toContain('技能要求')
  })

  it('deduplicates sessions with same desktop binding', () => {
    const deduped = deduplicateBridgeHistorySessions([
      row({
        id: 'a',
        bridge_project_path: 'D:\\project\\demo',
        bridge_agent_session_id: 'desktop-1',
        update_time: 10,
      }),
      row({
        id: 'b',
        bridge_project_path: 'D:\\project\\demo',
        bridge_agent_session_id: 'desktop-1',
        update_time: 20,
      }),
    ])
    expect(deduped).toHaveLength(1)
    expect(deduped[0]?.id).toBe('b')
  })
})
