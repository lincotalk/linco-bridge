import type { ChatMessage, ChatSessionItem } from '@/bridge/types'
import { apiGet, apiPost } from './http-client'

export async function fetchSessions(): Promise<ChatSessionItem[]> {
  const res = await apiGet<ChatSessionItem[]>('/api/sessions')
  if (!res.success || !res.data) {
    throw new Error(res.message || '加载会话失败')
  }
  return res.data
}

export async function fetchMessages(sessionId: string): Promise<ChatMessage[]> {
  const res = await apiGet<ChatMessage[]>(`/api/sessions/${sessionId}/messages`)
  if (!res.success || !res.data) {
    throw new Error(res.message || '加载消息失败')
  }
  return res.data
}

export async function sendSessionMessage(sessionId: string, content: string): Promise<ChatMessage> {
  const res = await apiPost<ChatMessage>(`/api/sessions/${sessionId}/messages`, { content })
  if (!res.success || !res.data) {
    throw new Error(res.message || '发送消息失败')
  }
  return res.data
}
