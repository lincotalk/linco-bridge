import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common'
import { ok } from '../shared/api-response'
import { isAgentBridgeType } from '../shared/constants'
import { BridgeService } from './bridge.service'

@Controller('agent-bridges')
export class BridgeController {
  constructor(private readonly bridgeService: BridgeService) {}

  @Get(':type/setup')
  getSetup(
    @Param('type') type: string,
    @Query('connectionId') connectionId?: string,
    @Query('connection_id') snakeConnectionId?: string,
  ) {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    return ok(this.bridgeService.getSetup(type, (connectionId ?? snakeConnectionId)?.trim()))
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
  getStatus(
    @Param('type') type: string,
    @Query('connectionId') connectionId?: string,
    @Query('connection_id') snakeConnectionId?: string,
  ) {
    return ok(this.bridgeService.getStatus(type, (connectionId ?? snakeConnectionId)?.trim()))
  }

  @Get(':type/contexts')
  async listContexts(
    @Param('type') type: string,
    @Query('connectionId') connectionId?: string,
    @Query('connection_id') snakeConnectionId?: string,
  ) {
    return ok(
      await this.bridgeService.listContexts(type, (connectionId ?? snakeConnectionId)?.trim()),
    )
  }

  @Get(':type/projects')
  async listProjects(
    @Param('type') type: string,
    @Query('connectionId') connectionId?: string,
    @Query('connection_id') snakeConnectionId?: string,
  ) {
    return ok(
      await this.bridgeService.listProjects(type, (connectionId ?? snakeConnectionId)?.trim()),
    )
  }

  @Post(':type/select-project')
  async selectProject(
    @Param('type') type: string,
    @Body()
    body: {
      projectPath?: string
      project_path?: string
      connectionId?: string
      connection_id?: string
    },
  ) {
    const projectPath = (body.projectPath ?? body.project_path)?.trim()
    if (!projectPath) {
      throw new NotFoundException('projectPath 不能为空')
    }
    return ok(
      await this.bridgeService.selectProject(
        type,
        (body.connectionId ?? body.connection_id)?.trim(),
        projectPath,
      ),
    )
  }

  @Get(':type/sessions')
  async listProjectSessions(
    @Param('type') type: string,
    @Query('connectionId') connectionId?: string,
    @Query('connection_id') snakeConnectionId?: string,
    @Query('projectPath') projectPath?: string,
    @Query('project_path') snakeProjectPath?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const path = (projectPath ?? snakeProjectPath)?.trim()
    if (!path) {
      throw new NotFoundException('projectPath 不能为空')
    }
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 10
    return ok(
      await this.bridgeService.listProjectSessions(
        type,
        (connectionId ?? snakeConnectionId)?.trim(),
        path,
        Number.isFinite(limit) && limit > 0 ? limit : 10,
      ),
    )
  }

  @Get(':type/chats')
  async listChats(
    @Param('type') type: string,
    @Query('connectionId') connectionId?: string,
    @Query('connection_id') snakeConnectionId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 10
    return ok(
      await this.bridgeService.listChats(
        type,
        (connectionId ?? snakeConnectionId)?.trim(),
        Number.isFinite(limit) && limit > 0 ? limit : 10,
      ),
    )
  }

  @Post(':type/workspace/apply')
  async applyWorkspace(
    @Param('type') type: string,
    @Body() body: Record<string, unknown>,
  ) {
    return ok(
      await this.bridgeService.applyWorkspaceSelection(
        type,
        (body.connectionId as string | undefined) ?? (body.connection_id as string | undefined),
        body,
      ),
    )
  }

  @Post(':type/bind-context')
  async bindContext(
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
      await this.bridgeService.bindContext(
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

  @Get(':type/settings/options')
  async loadSettingsOptions(
    @Param('type') type: string,
    @Query('connectionId') connectionId?: string,
    @Query('connection_id') snakeConnectionId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('session_id') snakeSessionId?: string,
  ) {
    return ok(
      await this.bridgeService.loadSettingsOptions(
        type,
        (connectionId ?? snakeConnectionId)?.trim(),
        (sessionId ?? snakeSessionId)?.trim(),
      ),
    )
  }

  @Post(':type/settings/update')
  async updateBridgeSettings(
    @Param('type') type: string,
    @Body()
    body: {
      connectionId?: string
      connection_id?: string
      sessionId?: string
      session_id?: string
      reasoningEffort?: string
      reasoning_effort?: string
      modelId?: string
      model_id?: string
      modelName?: string
      model_name?: string
    },
  ) {
    const sessionId = (body.sessionId ?? body.session_id)?.trim()
    if (!sessionId) {
      throw new NotFoundException('sessionId 不能为空')
    }
    return ok(
      await this.bridgeService.updateBridgeSettings(
        type,
        (body.connectionId ?? body.connection_id)?.trim(),
        sessionId,
        {
          reasoningEffort: body.reasoningEffort ?? body.reasoning_effort,
          modelId: body.modelId ?? body.model_id,
          modelName: body.modelName ?? body.model_name,
        },
      ),
    )
  }
}
