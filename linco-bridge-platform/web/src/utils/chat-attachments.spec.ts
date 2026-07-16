import { describe, expect, it } from 'vitest'
import {
  cloneOutboundFiles,
  isImageAttachment,
  mapOutboundFilesToAttachments,
  normalizeAttachmentMimeType,
  sanitizeOutboundBase64,
  toApiOutboundFiles,
} from '@/utils/chat-attachments'

describe('chat-attachments', () => {
  it('normalizes wechat chooseMessageFile type=image to real mime', () => {
    expect(normalizeAttachmentMimeType('3.png', 'image')).toBe('image/png')
    expect(normalizeAttachmentMimeType('shot.jpg', 'image')).toBe('image/jpeg')
    expect(normalizeAttachmentMimeType('a.bin', 'file')).toBe('application/octet-stream')
    expect(normalizeAttachmentMimeType('x.png', 'image/png')).toBe('image/png')
  })

  it('aliases non-standard image mime types used by browsers', () => {
    expect(normalizeAttachmentMimeType('a.jpg', 'image/jpg')).toBe('image/jpeg')
    expect(normalizeAttachmentMimeType('a.jpg', 'image/pjpeg')).toBe('image/jpeg')
    expect(normalizeAttachmentMimeType('a.png', 'image/x-png')).toBe('image/png')
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

  it('strips data-url prefix before api payload', () => {
    const [item] = toApiOutboundFiles([
      {
        name: 'dot.png',
        mimeType: 'image/png',
        base64: 'data:image/png;base64,abc123',
      },
    ])
    expect(item.base64).toBe('abc123')
  })

  it('cloneOutboundFiles survives source array reset', () => {
    const source = [
      {
        name: 'a.png',
        mimeType: 'image/png',
        base64: 'abc',
        localPath: 'wxfile://tmp',
      },
    ]
    const snapshot = cloneOutboundFiles(source)
    source.length = 0
    expect(snapshot).toHaveLength(1)
    expect(snapshot[0]?.base64).toBe('abc')
    expect(sanitizeOutboundBase64(' data:img/png;base64, xyz ')).toBe('xyz')
  })
})
