const { sendError, sendSystem } = require('../core/protocol');
const { normalizeApproveMode } = require('../core/session');
const { currentHermesProfile, currentOpenClawAgentId } = require('./agentSelection');
const { currentModel } = require('./model');
const {
  sendSlashCommandResult,
  usesProviderManagedWorkspace,
} = require('./common');

function sendStatus(ws, session, config = {}) {
  const processRunning = !!(
    (session.agentProcess || session.claudeProcess) &&
    (session.agentProcess || session.claudeProcess).exitCode === null &&
    !(session.agentProcess || session.claudeProcess).killed
  );

  const historyCount = session.agentSessionHistory?.length || 0;
  const activeEntry = session.agentSessionHistory?.find(e => e.isActive);
  const agentType = session.agentType || 'claude';
  const model = currentModel(session, config);
  const modeDetail = agentType === 'openclaw'
    ? `\nOpenClaw Agent: ${currentOpenClawAgentId(session, config)}`
    : agentType === 'hermes'
      ? `\nHermes Profile: ${currentHermesProfile(session, config)}`
      : '';

  const workspaceLine = usesProviderManagedWorkspace(session) ? '' : `工作目录: ${session.workspace}\n`;

  sendSystem(ws, `📊 当前会话状态：
${workspaceLine}会话 ID: ${session.id}
存储 ID: ${session.storageId}
Agent 类型: ${agentType}${modeDetail}
Model: ${model || '(default)'}
Agent session: ${session.agentSessionId || '(尚未建立)'}
活跃历史条目: ${activeEntry ? `"${activeEntry.firstMessage?.slice(0, 40) || '(无)'}" (${activeEntry.id})` : '无'}
历史总数: ${historyCount}
Agent 进程: ${processRunning ? '运行中' : '未运行'}
当前 turn: ${session.isTurnActive ? '进行中' : '空闲'}
排队消息: ${session.messageQueue.length}
审批模式: ${normalizeApproveMode(session.approveMode)}
待确认: ${session.pendingPermission ? '工具权限' : session.pendingDanger ? '危险操作' : '无'}`);
}

function handleSessionId(ws, session) {
  const agentType = session.agentType || 'claude';
  if (!['claude', 'codex'].includes(agentType)) {
    sendError(ws, `/session 目前只支持 Claude 和 Codex 模式，当前是 ${agentType}。`);
    return;
  }

  const agentSessionId = session.agentSessionId || null;
  sendSlashCommandResult(ws, 'session', {
    agentType,
    sessionKey: session.id,
    agentSessionId,
    established: Boolean(agentSessionId),
  });

  sendSystem(ws, agentSessionId
    ? `${agentType} Agent Session ID: ${agentSessionId}`
    : `当前 ${agentType} 还没有 Agent Session ID。请先发送一条消息建立会话。`);
}

function sendBaseInfo(ws, session, config) {
  const lines = ['🗄️ Linco 运行信息：'];
  if (!usesProviderManagedWorkspace(session)) {
    lines.push(`当前工作目录: ${session.workspace}`);
  }
  lines.push(`Linco Home: ${config.lincoHome}`);
  lines.push(`会话运行目录: ${session.runtimeDir}`);
  lines.push(`附件目录: ${session.attachmentsDir}`);
  sendSystem(ws, lines.join('\n'));
}

function formatTokenCount(n) {
  if (!n) return '0';
  return n.toLocaleString();
}

function handleUsage(ws, session) {
  if ((session.agentType || 'claude') === 'openclaw' && !(session.usage?.inputTokens || session.usage?.outputTokens)) {
    sendSystem(ws, 'OpenClaw usage data is not available yet for this session.');
    return;
  }
  if ((session.agentType || 'claude') === 'codex') {
    sendSystem(ws, '📊 Codex 当前暂不提供 Token 用量统计。');
    return;
  }

  const history = session.agentSessionHistory || [];
  const current = session.usage || { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  const total = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  for (const entry of history) {
    total.inputTokens += entry.usage?.inputTokens || 0;
    total.outputTokens += entry.usage?.outputTokens || 0;
    total.cacheReadTokens += entry.usage?.cacheReadTokens || 0;
    total.cacheCreationTokens += entry.usage?.cacheCreationTokens || 0;
  }

  const grandTotal = total.inputTokens + total.outputTokens + total.cacheReadTokens + total.cacheCreationTokens;

  let text = `📊 Token 用量统计：\n\n`;
  text += `当前 Session:\n`;
  text += `  Input: ${formatTokenCount(current.inputTokens)} | Output: ${formatTokenCount(current.outputTokens)}`;
  if (current.cacheReadTokens || current.cacheCreationTokens) {
    text += ` | Cache Read: ${formatTokenCount(current.cacheReadTokens)} | Cache Create: ${formatTokenCount(current.cacheCreationTokens)}`;
  }
  text += `\n\n`;
  text += `全部 Session 累计:\n`;
  text += `  Input: ${formatTokenCount(total.inputTokens)} | Output: ${formatTokenCount(total.outputTokens)}`;
  if (total.cacheReadTokens || total.cacheCreationTokens) {
    text += ` | Cache Read: ${formatTokenCount(total.cacheReadTokens)} | Cache Create: ${formatTokenCount(total.cacheCreationTokens)}`;
  }
  text += `\n  总计: ${formatTokenCount(grandTotal)} tokens`;

  sendSystem(ws, text);
}

module.exports = {
  sendStatus,
  handleSessionId,
  sendBaseInfo,
  handleUsage,
};
