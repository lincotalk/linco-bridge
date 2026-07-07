import { normalizeSessionPreview } from '../src/chat/session-preview.util'

describe('normalizeSessionPreview', () => {
  it('collapses multiline assistant text', () => {
    const preview = normalizeSessionPreview('line one\nline two\nline three')
    expect(preview).toBe('line one line two line three')
  })

  it('replaces fenced code with marker', () => {
    const preview = normalizeSessionPreview('before\n```ts\nconst x = 1\n```\nafter')
    expect(preview).toBe('before [代码] after')
  })
})
