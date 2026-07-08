import { describe, expect, it } from 'vitest'
import {
  buildBridgeFileGetCandidates,
  isLocalFileLinkTarget,
  isOpenableFileLinkTarget,
  normalizeBridgeFileGetPath,
  quoteGetPath,
  shouldRetryBridgeFileGet,
} from './attachment-open'

describe('attachment-open', () => {
  it('quotes paths with spaces', () => {
    expect(quoteGetPath('D:\\project\\a b.pdf')).toBe('"D:\\project\\a b.pdf"')
  })

  it('detects local file link targets', () => {
    expect(isLocalFileLinkTarget('D:\\tmp\\report.pdf')).toBe(true)
    expect(isLocalFileLinkTarget('https://example.com/a.pdf')).toBe(false)
    expect(isLocalFileLinkTarget('卤肉饭制作过程.txt')).toBe(true)
    expect(isLocalFileLinkTarget('outputs/outline.md')).toBe(true)
    expect(isLocalFileLinkTarget('file:///C:/workspace/report.txt')).toBe(true)
  })

  it('rejects workspace directory links', () => {
    expect(
      isOpenableFileLinkTarget('C:\\Users\\demo\\AppData\\Local\\linco-bridge\\sessions\\sid_abc\\workspace'),
    ).toBe(false)
    expect(isOpenableFileLinkTarget('卤肉饭制作过程.txt')).toBe(true)
    expect(isOpenableFileLinkTarget('D:\\tmp\\report.pdf')).toBe(true)
  })

  it('builds basename fallback candidates for absolute paths', () => {
    expect(buildBridgeFileGetCandidates('D:\\tmp\\a\\report.pdf')).toEqual([
      'D:\\tmp\\a\\report.pdf',
      'report.pdf',
    ])
  })

  it('retries when connector rejects stale absolute paths', () => {
    expect(shouldRetryBridgeFileGet('拒绝读取该路径：只能获取当前工作目录、运行目录或附件目录内的文件。')).toBe(true)
    expect(shouldRetryBridgeFileGet('文件不存在：missing.txt')).toBe(true)
    expect(shouldRetryBridgeFileGet('不是普通文件')).toBe(false)
  })

  it('normalizes bridge file paths for /get command', () => {
    expect(normalizeBridgeFileGetPath('卤肉饭制作过程.txt')).toBe('卤肉饭制作过程.txt')
    expect(normalizeBridgeFileGetPath('D:\\tmp\\readme.md:284')).toBe('D:\\tmp\\readme.md')
    expect(normalizeBridgeFileGetPath('<file:///D:/tmp/a.txt>')).toBe('D:/tmp/a.txt')
  })
})
