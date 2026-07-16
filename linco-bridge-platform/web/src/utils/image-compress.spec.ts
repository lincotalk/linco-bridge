import { describe, expect, it } from 'vitest'
import { compressOutboundImageIfNeeded } from '@/utils/image-compress'

describe('image-compress', () => {
  it('keeps small supported jpeg as-is after mime normalize', async () => {
    // 1x1 jpeg
    const tinyJpeg =
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z'
    const result = await compressOutboundImageIfNeeded({
      name: 'photo',
      mimeType: 'image/jpg',
      base64: tinyJpeg,
    })
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.name).toMatch(/\.jpe?g$/i)
    expect(result.base64).toBeTruthy()
  })

  it('leaves non-image files untouched', async () => {
    const result = await compressOutboundImageIfNeeded({
      name: 'note.txt',
      mimeType: 'text/plain',
      base64: 'aGVsbG8=',
    })
    expect(result).toEqual({
      name: 'note.txt',
      mimeType: 'text/plain',
      base64: 'aGVsbG8=',
    })
  })
})
