import { Body, Controller, Get, BadRequestException, NotFoundException, Param, Post, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ok } from '../shared/api-response'
import { isAgentBridgeType } from '../shared/constants'
import { ChatService } from './chat.service'

function writeSse(res: Response, event: string, data: Record<string, unknown>): void {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

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
  async listMessages(
    @Param('sessionId') sessionId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined
    return ok(
      await this.chatService.listMessages(
        sessionId,
        Number.isFinite(parsedLimit) && parsedLimit! > 0 ? parsedLimit : undefined,
      ),
    )
  }

  @Post('sessions/:sessionId/messages')
  async sendMessage(@Param('sessionId') sessionId: string, @Body() body: { content?: string }) {
    const content = body.content?.trim() ?? ''
    return ok(await this.chatService.sendMessage(sessionId, content))
  }

  @Post('sessions/:sessionId/messages/stream')
  async streamMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: { content?: string; files?: Array<{ name?: string; mimeType?: string; base64?: string; url?: string }> },
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    try {
      await this.chatService.sendMessageStream(
        sessionId,
        body.content ?? '',
        (event, data) => {
          writeSse(res, event, data)
        },
        body.files ?? [],
      )
      res.end()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'stream failed'
      writeSse(res, 'error', { message })
      res.end()
    }
  }

  @Post('sessions/:sessionId/bridge-command')
  async runSessionBridgeCommand(
    @Param('sessionId') sessionId: string,
    @Body() body: { command?: string },
  ) {
    const command = body.command?.trim() ?? ''
    if (!command) {
      throw new BadRequestException('command required')
    }
    return ok(await this.chatService.runBridgeCommand(sessionId, command))
  }

  @Post('sessions/:sessionId/messages/cancel')
  cancelStreamMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: { streamId?: string },
  ) {
    const message = this.chatService.cancelStreamTurn(body.streamId ?? '', sessionId)
    return ok({ cancelled: Boolean(message), message })
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

  @Post('agent-chat/:type/bridge-command')
  async runAgentBridgeCommand(
    @Param('type') type: string,
    @Body() body: { command?: string },
  ) {
    const command = body.command?.trim() ?? ''
    if (!command) {
      throw new BadRequestException('command required')
    }
    return ok(await this.chatService.runBridgeCommandByAgent(type, command))
  }
}
