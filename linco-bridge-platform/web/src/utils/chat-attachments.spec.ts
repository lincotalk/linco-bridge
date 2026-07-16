import { describe, expect, it } from 'vitest'
import {
  isImageAttachment,
  mapOutboundFilesToAttachments,
  normalizeAttachmentMimeType,
  toApiOutboundFiles,
} from '@/utils/chat-attachments'

describe('chat-attachments', () => {
  it('normalizes wechat chooseMessageFile type=image to real mime', () => {
    expect(normalizeAttachmentMimeType('3.png', 'image')).toBe('image/png')
    expect(normalizeAttachmentMimeType('shot.jpg', 'image')).toBe('image/jpeg')
    expect(normalizeAttachmentMimeType('a.bin', 'file')).toBe('application/octet-stream')
    expect(normalizeAttachmentMimeType('x.png', 'image/png')).toBe('image/png')
  })

  it('maps pending image with localPath for mini program preview', () => {
    const [item] = mapOutboundFilesToAttachments([
      {
        name: '3.png',
        mimeType: 'image',
        base64: 'abc',
        localPath: 'wxfile://tmp_3.png',
      },
    ])
    expect(item.mimeType).toBe('image/png')
    expect(item.previewUrl).toBe('wxfile://tmp_3.png')
    expect(isImageAttachment(item)).toBe(true)
  })

  it('strips localPath when preparing api payload', () => {
    const [item] = toApiOutboundFiles([
      {
        name: '3.png',
        mimeType: 'image',
        base64: 'abc',
        localPath: 'wxfile://tmp_3.png',
      },
    ])
    expect(item).toEqual({
      name: '3.png',
      mimeType: 'image/png',
      base64: 'abc',
      url: undefined,
    })
    expect('localPath' in item).toBe(false)
  })

  it('builds data-url preview when no localPath (history reload path)', () => {
    const [item] = mapOutboundFilesToAttachments([
      {
        name: 'dot.png',
        mimeType: 'image/png',
        base64: 'abc',
      },
    ])
    expect(item.previewUrl).toBe('data:image/png;base64,abc')
    expect(isImageAttachment(item)).toBe(true)
  })
})
