import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChatCodeBlock from './ChatCodeBlock.vue'

describe('ChatCodeBlock', () => {
  it('shows streaming indicator when code block is incomplete', () => {
    const wrapper = mount(ChatCodeBlock, {
      props: {
        code: 'const x = 1',
        language: 'ts',
        showStreamingIndicator: true,
      },
    })
    expect(wrapper.find('.chat-code__streaming-text').text()).toBe('正在输出...')
  })

  it('hides streaming indicator for completed code blocks', () => {
    const wrapper = mount(ChatCodeBlock, {
      props: {
        code: 'const x = 1',
        language: 'ts',
        showStreamingIndicator: false,
      },
    })
    expect(wrapper.find('.chat-code__streaming-text').exists()).toBe(false)
  })

  it('shows preview toggle for markdown fences', () => {
    const wrapper = mount(ChatCodeBlock, {
      props: {
        code: '# Title',
        language: 'markdown',
      },
    })
    expect(wrapper.text()).toContain('预览')
    expect(wrapper.text()).toContain('代码')
  })
})
