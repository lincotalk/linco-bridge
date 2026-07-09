import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common'

import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'

import { BridgeModule } from './bridge/bridge.module'

import { ChatModule } from './chat/chat.module'

import { DatabaseModule } from './database/database.module'

import { HttpExceptionFilter } from './shared/http-exception.filter'

import { TransformInterceptor } from './shared/transform.interceptor'

import { VisitorMiddleware } from './shared/visitor.middleware'

import { VisitorModule } from './shared/visitor.module'



@Module({

  imports: [DatabaseModule, VisitorModule, BridgeModule, ChatModule],

  providers: [

    { provide: APP_FILTER, useClass: HttpExceptionFilter },

    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },

  ],

})

export class AppModule implements NestModule {

  configure(consumer: MiddlewareConsumer): void {

    consumer

      .apply(VisitorMiddleware)

      .exclude(
        { path: 'demo-config', method: RequestMethod.GET },
        { path: 'admin/reset-demo-db', method: RequestMethod.POST },
      )

      .forRoutes({ path: '*', method: RequestMethod.ALL })

  }

}

