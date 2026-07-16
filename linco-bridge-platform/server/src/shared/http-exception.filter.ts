import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import type { Response } from 'express'
import { fail } from './api-response'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const payload = exception.getResponse()
      const message =
        typeof payload === 'string'
          ? payload
          : typeof payload === 'object' && payload && 'message' in payload
            ? String(payload.message)
            : exception.message

      response.status(status).json(fail(status, message))
      return
    }

    const rawMessage =
      exception instanceof Error ? exception.message : typeof exception === 'string' ? exception : ''
    if (/request entity too large|PayloadTooLargeError/i.test(rawMessage)) {
      response
        .status(HttpStatus.PAYLOAD_TOO_LARGE)
        .json(fail(4130, '附件过大，请压缩后重试（单次请求上限约 25MB）'))
      return
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(fail(5000, 'Internal server error'))
  }
}
