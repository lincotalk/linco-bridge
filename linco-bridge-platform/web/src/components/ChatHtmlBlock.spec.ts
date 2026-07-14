import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChatHtmlBlock from './ChatHtmlBlock.vue'

describe('ChatHtmlBlock', () => {
  it('shows streaming indicator for incomplete html blocks', () => {
    const wrapper = mount(ChatHtmlBlock, {
      props: {
        html: '<section>',
        incomplete: true,
      },
    })
    expect(wrapper.find('.chat-html__streaming-text').text()).toBe('正在输出...')
  })

  it('renders html label in header', () => {
    const wrapper = mount(ChatHtmlBlock, {
      props: {
        html: '<p>Hello</p>',
      },
    })
    expect(wrapper.text()).toContain('html')
  })
})
