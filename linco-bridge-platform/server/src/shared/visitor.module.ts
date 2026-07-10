import { Global, Module } from '@nestjs/common'
import { ResourceAccessService } from './resource-access.service'
import { VisitorContextService } from './visitor-context.service'
import { VisitorController } from './visitor.controller'
import { VisitorMiddleware } from './visitor.middleware'

@Global()
@Module({
  controllers: [VisitorController],
  providers: [VisitorContextService, ResourceAccessService, VisitorMiddleware],
  exports: [VisitorContextService, ResourceAccessService, VisitorMiddleware],
})
export class VisitorModule {}
