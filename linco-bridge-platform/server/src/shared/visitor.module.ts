import { Global, Module } from '@nestjs/common'
import { ResourceAccessService } from './resource-access.service'
import { VisitorContextService } from './visitor-context.service'
import { VisitorMiddleware } from './visitor.middleware'

@Global()
@Module({
  providers: [VisitorContextService, ResourceAccessService, VisitorMiddleware],
  exports: [VisitorContextService, ResourceAccessService, VisitorMiddleware],
})
export class VisitorModule {}
