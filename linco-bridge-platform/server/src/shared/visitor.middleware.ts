import { BadRequestException, Injectable, NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { parseVisitorIdHeader, VISITOR_ID_HEADER } from './visitor-id.util'
import { VisitorContextService } from './visitor-context.service'

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

    const visitorId = parseVisitorIdHeader(req.headers[VISITOR_ID_HEADER])
    if (!visitorId) {
      throw new BadRequestException('缺少访客标识')
    }

    this.visitorContext.run(visitorId, () => next())
  }
}
