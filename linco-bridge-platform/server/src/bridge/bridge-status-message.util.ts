/** Filter connector session bootstrap banners (aligned with aichat-service im.gateway). */

export function isBridgeSessionStatusMessage(text: string): boolean {
  const normalized = text.trim()
  if (!normalized) return false

  if (/(?:Claw|Claude|Codex|Hermes)\s+正在思考/i.test(normalized)) {
    return true
  }

  if (
    /^(?:claude|codex|hermes|openclaw|open\s*claw)\s+Agent\s+Session\s+ID\s*:/i.test(
      normalized,
    )
  ) {
    return true
  }

  if (/还没有 Agent Session ID/i.test(normalized)) {
    return true
  }

  if (/请先发送一条消息建立会话/i.test(normalized)) {
    return true
  }

  if (
    /^(?:👋\s*)?已连接到\s+/i.test(normalized) &&
    /(?:^|\n)工作目录[：:]/.test(normalized)
  ) {
    return true
  }

  if (
    /^(?:👋\s*)?已连接到\s+Linco\s+Agent/i.test(normalized) &&
    /(?:^|\n)📂?\s*工作目录[：:]/.test(normalized)
  ) {
    return true
  }

  return false
}
