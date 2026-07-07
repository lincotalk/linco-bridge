import { BridgePresenceService } from '../src/bridge/bridge-presence.service'
import {
  formatSessionListTitle,
  resolveConnectionDeviceName,
  resolveSessionDeviceName,
  stripDeviceSuffixFromTitle,
} from '../src/chat/session-list-title.util'

describe('formatSessionListTitle', () => {
  it('appends device name when present', () => {
    expect(formatSessionListTitle('今天星期几啊', 'MacBook Pro')).toBe(
      '今天星期几啊 - MacBook Pro',
    )
  })

  it('skips duplicate suffix', () => {
    expect(formatSessionListTitle('今天星期几啊 - MacBook Pro', 'MacBook Pro')).toBe(
      '今天星期几啊 - MacBook Pro',
    )
  })

  it('returns title unchanged when device name is empty', () => {
    expect(formatSessionListTitle('今天星期几啊', '')).toBe('今天星期几啊')
  })
})

describe('stripDeviceSuffixFromTitle', () => {
  it('removes trailing device suffix', () => {
    expect(stripDeviceSuffixFromTitle('深圳最近会下雨吗 - HQ-TS-0182', 'HQ-TS-0182')).toBe(
      '深圳最近会下雨吗',
    )
  })

  it('returns title unchanged when suffix does not match', () => {
    expect(stripDeviceSuffixFromTitle('今天星期几啊', 'HQ-TS-0182')).toBe('今天星期几啊')
  })
})

describe('resolveConnectionDeviceName', () => {
  it('prefers live presence device name', () => {
    const presence = new BridgePresenceService()
    presence.updateDeviceInfo('conn-1', { name: 'ThinkPad' })
    expect(
      resolveConnectionDeviceName('conn-1', presence, {
        device_name: 'MacBook Pro',
        device_id: null,
      }),
    ).toBe('ThinkPad')
  })

  it('falls back to stored connection device name', () => {
    const presence = new BridgePresenceService()
    expect(
      resolveConnectionDeviceName('conn-1', presence, {
        device_name: 'Mac mini',
        device_id: null,
      }),
    ).toBe('Mac mini')
  })
})

describe('resolveSessionDeviceName', () => {
  it('prefers session-scoped device name', () => {
    const presence = new BridgePresenceService()
    expect(
      resolveSessionDeviceName('MacBook Pro', {
        id: 'conn-1',
        bridge_type: 'codex',
        app_id: 'a',
        app_secret: 's',
        account_id: 'u',
        bound_context_id: null,
        bound_context_name: null,
        bridge_project_path: null,
        bridge_agent_session_id: null,
        session_id: null,
        device_id: null,
        device_name: 'ThinkPad',
        create_time: 0,
        update_time: 0,
      }, presence),
    ).toBe('MacBook Pro')
  })
})
