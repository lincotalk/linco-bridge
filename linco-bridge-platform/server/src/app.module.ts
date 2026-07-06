import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { BridgeModule } from './bridge/bridge.module'
import { ChatModule } from './chat/chat.module'
import { DatabaseModule } from './database/database.module'
import { HttpExceptionFilter } from './shared/http-exception.filter'
import { TransformInterceptor } from './shared/transform.interceptor'

@Module({
  imports: [DatabaseModule, BridgeModule, ChatModule],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
