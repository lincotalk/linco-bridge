import { BadRequestException } from '@nestjs/common'

const ALLOWED_COMMAND_PATTERNS: RegExp[] = [
  /^\/help(?:\s|$)/i,
  /^\/get\s+\S/i,
  /^\/history(?:\s|$|-)/i,
  /^\/history-reload(?:\s|$|-)/i,
  /^\/sessions(?:\s|$|-)/i,
  /^\/bind --chat\s+\S/i,
  /^\/bind --project\s+\S/i,
  /^\/project --select\s+\S/i,
  /^\/settings apply\s+/i,
  /^\/settings(?:\s|$)/i,
  /^\/projects(?:\s|$)/i,
  /^\/agents(?:\s|$)/i,
  /^\/profiles(?:\s|$)/i,
]

const FORBIDDEN_GET_CHARS = /[\0\r\n|;&`$<>]/

export function validateBridgeGetPath(rawPath: string): string {
  const path = rawPath.trim()
  if (!path) {
    throw new BadRequestException('文件路径不能为空')
  }
  if (path.length > 4096) {
    throw new BadRequestException('文件路径过长')
  }
  if (FORBIDDEN_GET_CHARS.test(path)) {
    throw new BadRequestException('文件路径包含非法字符')
  }
  return path
}

export function assertAllowedBridgeCommand(command: string): void {
  const trimmed = command.trim()
  if (!trimmed.startsWith('/')) {
    throw new BadRequestException('仅支持 slash 命令')
  }

  const allowed = ALLOWED_COMMAND_PATTERNS.some((pattern) => pattern.test(trimmed))
  if (!allowed) {
    throw new BadRequestException('不允许的 bridge 命令')
  }

  if (/^\/get\s+/i.test(trimmed)) {
    validateBridgeGetPath(trimmed.replace(/^\/get\s+/i, '').trim())
  }
}
