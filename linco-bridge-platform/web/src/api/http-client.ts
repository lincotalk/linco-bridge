import type { ApiResponse } from '@/bridge/types'

const DEFAULT_BASE_URL = ''

export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  return (typeof fromEnv === 'string' && fromEnv.trim()) || DEFAULT_BASE_URL
}

async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = (await response.json()) as ApiResponse<T>
  return payload
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: 'include',
  })
  return parseResponse<T>(response)
}

export async function apiPost<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return parseResponse<T>(response)
}
