import { isBridgeSessionStatusMessage } from '../src/bridge/bridge-status-message.util'

describe('isBridgeSessionStatusMessage', () => {
  it('detects connector session bootstrap banner', () => {
    expect(
      isBridgeSessionStatusMessage(`已连接到 codex Agent
工作目录: C:\\Users\\test\\.linco\\codex\\sessions\\sid_test\\workspace
输入 /help 查看可用命令`),
    ).toBe(true)
  })

  it('does not treat normal answers as status', () => {
    expect(isBridgeSessionStatusMessage('你是开发者，正在使用 AIChat。')).toBe(false)
  })
})
