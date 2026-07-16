import { Body, Controller, Get, BadRequestException, Headers, NotFoundException, Param, Post, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ok } from '../shared/api-response'
import { isAgentBridgeType } from '../shared/constants'
import { parseBridgeSessionSettings } from '../bridge/bridge-settings.util'
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

  @Post('admin/reset-demo-db')
  resetDemoDb(@Headers('x-demo-reset-token') resetToken?: string) {
    return ok(this.chatService.resetDemoData(resetToken))
  }

  @Get('sessions')
  listSessions() {
    return ok(this.chatService.listSessions())
  }

  @Post('bridge-command')
  async runGlobalBridgeCommand(@Body() body: { command?: string }) {
    const command = body.command?.trim() ?? ''
    if (!command) {
      throw new BadRequestException('command required')
    }
    return ok(await this.chatService.runGlobalBridgeCommand(command))
  }

  @Post('sessions/delete')
  deleteSessions(@Body() body: { sessionIds?: string[]; session_ids?: string[] }) {
    const sessionIds = body.sessionIds ?? body.session_ids ?? []
    return ok(this.chatService.deleteSessionsFromList(sessionIds))
  }

  @Post('sessions/:sessionId/resume')
  async resumeSession(@Param('sessionId') sessionId: string) {
    return ok(await this.chatService.resumeSession(sessionId))
  }

  @Get('sessions/:sessionId/messages')
  async listMessages(
    @Param('sessionId') sessionId: string,
    @Query('limit') limit?: string,
    @Query('reload') reload?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined
    const forceReload =
      reload === '1' || reload === 'true' || reload === 'yes'
    return ok(
      await this.chatService.listMessages(
        sessionId,
        Number.isFinite(parsedLimit) && parsedLimit! > 0 ? parsedLimit : undefined,
        { reload: forceReload },
      ),
    )
  }

  @Post('sessions/:sessionId/messages')
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      content?: string
      files?: Array<{ name?: string; mimeType?: string; base64?: string; url?: string }>
    },
  ) {
    const content = body.content?.trim() ?? ''
    return ok(await this.chatService.sendMessage(sessionId, content, body.files ?? []))
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
  getLandingHeader(
    @Param('type') type: string,
    @Query('connectionId') connectionId?: string,
  ) {
    return ok(this.chatService.getLandingHeader(type, connectionId))
  }

  @Get('agent-chat/:type/history')
  listAgentHistory(
    @Param('type') type: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('connectionId') connectionId?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : 50
    const parsedOffset = offset ? Number(offset) : 0
    return ok(
      this.chatService.listAgentHistory(
        type,
        Number.isFinite(parsedLimit) ? parsedLimit : 50,
        Number.isFinite(parsedOffset) ? parsedOffset : 0,
        connectionId,
      ),
    )
  }

  @Post('agent-chat/:type/history/hide')
  hideAgentHistory(
    @Param('type') type: string,
    @Body() body: { sessionIds?: string[] },
  ) {
    const sessionIds = Array.isArray(body.sessionIds) ? body.sessionIds : []
    return ok(this.chatService.hideAgentHistorySessions(type, sessionIds))
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
      connectionId?: string
      bridgeSettings?: {
        reasoningEffort?: string
        modelId?: string
        modelName?: string
      }
      bridge_settings?: {
        reasoning_effort?: string
        model_id?: string
        model_name?: string
      }
    },
  ) {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const bridgeSettings =
      parseBridgeSessionSettings(body.bridgeSettings ?? body.bridge_settings) ?? undefined
    return ok(
      await this.chatService.createConversation({
        agentType: type,
        message: body.message,
        tempSession: body.tempSession ?? body.temp_session,
        title: body.title,
        connectionId: body.connectionId,
        bridgeSettings,
      }),
    )
  }

  @Post('agent-chat/:type/bridge-command')
  async runAgentBridgeCommand(
    @Param('type') type: string,
    @Body() body: { command?: string; connectionId?: string },
  ) {
    const command = body.command?.trim() ?? ''
    if (!command) {
      throw new BadRequestException('command required')
    }
    return ok(
      await this.chatService.runBridgeCommandByAgent(type, command, body.connectionId),
    )
  }
}
