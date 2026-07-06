import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common'
import { ok } from '../shared/api-response'
import { isAgentBridgeType } from '../shared/constants'
import { BridgeService } from './bridge.service'

@Controller('agent-bridges')
export class BridgeController {
  constructor(private readonly bridgeService: BridgeService) {}

  @Get(':type/setup')
  getSetup(@Param('type') type: string) {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    return ok(this.bridgeService.getSetup(type))
  }

  @Post(':type/setup/refresh')
  refreshSetup(
    @Param('type') type: string,
    @Body() body: { connectionId?: string; connection_id?: string },
  ) {
    const connectionId = body.connectionId ?? body.connection_id
    if (!connectionId?.trim()) {
      throw new NotFoundException('connectionId 不能为空')
    }
    return ok(this.bridgeService.refreshSetup(type, connectionId.trim()))
  }

  @Get(':type/status')
  getStatus(@Param('type') type: string) {
    return ok(this.bridgeService.getStatus(type))
  }

  @Get(':type/contexts')
  listContexts(
    @Param('type') type: string,
    @Query('connectionId') connectionId?: string,
    @Query('connection_id') snakeConnectionId?: string,
  ) {
    return ok(this.bridgeService.listContexts(type, (connectionId ?? snakeConnectionId)?.trim()))
  }

  @Post(':type/bind-context')
  bindContext(
    @Param('type') type: string,
    @Body()
    body: {
      contextId?: string
      context_id?: string
      connectionId?: string
      connection_id?: string
    },
  ) {
    const contextId = (body.contextId ?? body.context_id)?.trim()
    if (!contextId) {
      throw new NotFoundException('contextId 不能为空')
    }
    return ok(
      this.bridgeService.bindContext(
        type,
        (body.connectionId ?? body.connection_id)?.trim(),
        contextId,
      ),
    )
  }

  @Post(':type/sync')
  syncAgent(
    @Param('type') type: string,
    @Body() body: { connectionId?: string; connection_id?: string },
  ) {
    return ok(this.bridgeService.syncAgent(type, (body.connectionId ?? body.connection_id)?.trim()))
  }
}
