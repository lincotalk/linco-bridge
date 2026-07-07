/** In-memory first message for landing → chat (aligned with Flutter agentChatLaunchPayload). */

let pendingLaunch: { sessionId: string; message: string } | null = null

export function stashPendingLaunch(sessionId: string, message: string) {
  const trimmed = message.trim()
  if (!trimmed) return
  pendingLaunch = { sessionId, message: trimmed }
}

export function takePendingLaunch(sessionId: string): string | undefined {
  if (pendingLaunch?.sessionId !== sessionId) return undefined
  const message = pendingLaunch.message
  pendingLaunch = null
  return message
}
