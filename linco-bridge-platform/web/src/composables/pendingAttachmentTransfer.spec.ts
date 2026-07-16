import { describe, expect, it } from 'vitest'
import { stashPendingFiles, takePendingFiles } from './pendingAttachmentTransfer'

describe('pendingAttachmentTransfer', () => {
  it('keeps stashed files when source array is cleared', () => {
    const source = [
      {
        name: 'a.png',
        mimeType: 'image/png',
        base64: 'abc',
        localPath: 'wxfile://tmp',
      },
    ]
    stashPendingFiles('session-a', source)
    source.length = 0
    const files = takePendingFiles('session-a')
    expect(files).toHaveLength(1)
    expect(files[0]?.base64).toBe('abc')
  })

  it('returns empty when session mismatches', () => {
    stashPendingFiles('session-a', [{ name: 'a.png', base64: 'abc' }])
    expect(takePendingFiles('session-b')).toEqual([])
    expect(takePendingFiles('session-a')).toHaveLength(1)
  })
})
