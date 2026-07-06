import { describe, expect, it, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BridgeSourceCard from '@/components/BridgeSourceCard.vue'
import type { BridgeSourceCard as BridgeSourceCardType } from '@/bridge/types'

const mockItem: BridgeSourceCardType = {
  type: 'codex',
  title: '从 Codex 导入',
  subtitle: '将手机与 Codex 连接',
  icon: '/static/icons/bot/codex.png',
  route: '/pages/bridge/import-local?type=codex',
}

describe('BridgeSourceCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders card title and subtitle', () => {
    const wrapper = mount(BridgeSourceCard, {
      props: { item: mockItem },
    })

    expect(wrapper.text()).toContain('从 Codex 导入')
    expect(wrapper.text()).toContain('将手机与 Codex 连接')
  })

  it('emits select when tapped', async () => {
    const wrapper = mount(BridgeSourceCard, {
      props: { item: mockItem },
    })

    await wrapper.trigger('tap')
    expect(wrapper.emitted('select')?.[0]).toEqual([mockItem])
  })
})
