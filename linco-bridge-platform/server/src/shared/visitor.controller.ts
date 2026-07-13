import { Controller, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ok } from './api-response'
import {
  buildVisitorSessionCookie,
  createNewVisitorSession,
  createVisitorSessionToken,
  parseVisitorSessionCookie,
  parseVisitorSessionHeader,
  VISITOR_SESSION_HEADER,
} from './visitor-session.util'

@Controller('visitor')
export class VisitorController {
  @Post('bootstrap')
  bootstrap(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const existingVisitorId =
      parseVisitorSessionCookie(req.headers.cookie) ??
      parseVisitorSessionHeader(req.headers[VISITOR_SESSION_HEADER])
    if (existingVisitorId) {
      const token = createVisitorSessionToken(existingVisitorId)
      res.setHeader('Set-Cookie', buildVisitorSessionCookie(token))
      return ok({ visitorId: existingVisitorId, reused: true, sessionToken: token })
    }

    const session = createNewVisitorSession()
    res.setHeader('Set-Cookie', buildVisitorSessionCookie(session.token))
    return ok({
      visitorId: session.visitorId,
      reused: false,
      sessionToken: session.token,
    })
  }
}
