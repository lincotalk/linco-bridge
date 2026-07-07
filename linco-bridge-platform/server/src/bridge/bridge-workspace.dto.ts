export interface BridgeWorkspaceSessionDto {
  id: string
  title: string
  timeText?: string
  bindCommand?: string
  historyCommand?: string
  updatedAt?: number
}

export interface WorkspaceApplyInputDto {
  projectPath?: string
  project_path?: string
  projectName?: string
  project_name?: string
  agentSessionId?: string
  agent_session_id?: string
  sessionTitle?: string
  session_title?: string
  bindCommand?: string
  bind_command?: string
  selectProjectCommand?: string
  select_project_command?: string
  platformSessionId?: string
  platform_session_id?: string
}

export interface WorkspaceApplyResultDto {
  sessionId: string
  title: string
  projectPath: string
  projectName: string
  agentSessionId?: string
}
