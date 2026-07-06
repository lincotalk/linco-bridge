import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ok } from '../shared/api-response'
import { ChatService } from './chat.service'

@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('demo-config')
  getDemoConfig() {
    return ok(this.chatService.getDemoConfig())
  }

  @Get('sessions')
  listSessions() {
    return ok(this.chatService.listSessions())
  }

  @Get('sessions/:sessionId/messages')
  listMessages(@Param('sessionId') sessionId: string) {
    return ok(this.chatService.listMessages(sessionId))
  }

  @Post('sessions/:sessionId/messages')
  async sendMessage(@Param('sessionId') sessionId: string, @Body() body: { content?: string }) {
    const content = body.content?.trim() ?? ''
    return ok(await this.chatService.sendMessage(sessionId, content))
  }
}
