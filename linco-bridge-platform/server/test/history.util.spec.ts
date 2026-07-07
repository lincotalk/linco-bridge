import { roundsToMessages } from '../src/bridge/history.util'

describe('roundsToMessages', () => {
  it('converts history rounds to user/assistant messages', () => {
    const messages = roundsToMessages('session-1', {
      version: 1,
      returnedRounds: 2,
      rounds: [
        {
          index: 1,
          timestampMs: 1000,
          user: { text: 'hello', timestampMs: 1000 },
          assistant: { text: 'hi there', timestampMs: 1001 },
        },
        {
          index: 2,
          timestampMs: 2000,
          user: { text: 'second', timestampMs: 2000 },
          assistant: { text: 'reply two', timestampMs: 2001 },
        },
      ],
    })

    expect(messages).toHaveLength(4)
    expect(messages[0]).toMatchObject({ role: 'user', content: 'hello', createdAt: 1000 })
    expect(messages[1]).toMatchObject({ role: 'assistant', content: 'hi there', createdAt: 1001 })
    expect(messages[2]).toMatchObject({ role: 'user', content: 'second' })
    expect(messages[3]).toMatchObject({ role: 'assistant', content: 'reply two' })
  })

  it('returns empty list for missing rounds', () => {
    expect(roundsToMessages('session-1', {})).toEqual([])
  })

  it('maps history files to message attachments', () => {
    const messages = roundsToMessages('session-1', {
      rounds: [
        {
          index: 1,
          user: {
            text: '',
            files: [
              {
                name: 'photo.png',
                mimeType: 'image/png',
                base64: 'abc123',
              },
            ],
          },
          assistant: { text: 'received' },
        },
      ],
    })

    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: '[1 个附件]',
      attachments: [
        {
          name: 'photo.png',
          mimeType: 'image/png',
          previewUrl: 'data:image/png;base64,abc123',
        },
      ],
    })
  })
})
