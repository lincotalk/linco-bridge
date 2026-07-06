import { Module } from '@nestjs/common'
import { BridgeModule } from '../bridge/bridge.module'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'

@Module({
  imports: [BridgeModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
