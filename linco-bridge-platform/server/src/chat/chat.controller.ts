import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common'
import { ok } from '../shared/api-response'
import { isAgentBridgeType } from '../shared/constants'
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

  @Get('agent-chat/:type/landing-header')
  getLandingHeader(@Param('type') type: string) {
    return ok(this.chatService.getLandingHeader(type))
  }

  @Get('agent-chat/:type/history')
  listAgentHistory(
    @Param('type') type: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : 50
    const parsedOffset = offset ? Number(offset) : 0
    return ok(
      this.chatService.listAgentHistory(
        type,
        Number.isFinite(parsedLimit) ? parsedLimit : 50,
        Number.isFinite(parsedOffset) ? parsedOffset : 0,
      ),
    )
  }

  @Post('agent-chat/:type/conversations')
  async startConversation(
    @Param('type') type: string,
    @Body()
    body: {
      message?: string
      tempSession?: boolean
      temp_session?: boolean
      title?: string
    },
  ) {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    return ok(
      await this.chatService.createConversation({
        agentType: type,
        message: body.message,
        tempSession: body.tempSession ?? body.temp_session,
        title: body.title,
      }),
    )
  }
}
