export interface ApiResponse<T> {
  code: number
  success: boolean
  data: T | null
  message: string
}

export function ok<T>(data: T, message = ''): ApiResponse<T> {
  return { code: 0, success: true, data, message }
}

export function fail<T = null>(
  code: number,
  message: string,
  data: T | null = null,
): ApiResponse<T> {
  return { code, success: false, data, message }
}
