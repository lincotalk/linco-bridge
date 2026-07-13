import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common'

import type { NextFunction, Request, Response } from 'express'

import { parseVisitorIdHeader, VISITOR_ID_HEADER } from './visitor-id.util'

import { VisitorContextService } from './visitor-context.service'

import {
  parseVisitorSessionHeader,
  parseVisitorSessionCookie,
  VISITOR_SESSION_HEADER,
} from './visitor-session.util'



@Injectable()

export class VisitorMiddleware implements NestMiddleware {

  constructor(private readonly visitorContext: VisitorContextService) {}



  use(req: Request, _res: Response, next: NextFunction): void {

    const path = req.path

    if (!path.startsWith('/api/')) {

      next()

      return

    }

    if (path === '/api/demo-config') {

      next()

      return

    }

    if (path === '/api/admin/reset-demo-db') {

      next()

      return

    }

    if (path === '/api/visitor/bootstrap') {

      next()

      return

    }



    const visitorId =
      parseVisitorSessionCookie(req.headers.cookie) ??
      parseVisitorSessionHeader(req.headers[VISITOR_SESSION_HEADER])

    if (!visitorId) {
      throw new UnauthorizedException('缺少有效访客会话，请先 bootstrap')
    }



    const spoofedHeader = parseVisitorIdHeader(req.headers[VISITOR_ID_HEADER])

    if (spoofedHeader && spoofedHeader !== visitorId) {

      throw new UnauthorizedException('访客标识与 session 不一致')

    }



    this.visitorContext.run(visitorId, () => next())

  }

}
