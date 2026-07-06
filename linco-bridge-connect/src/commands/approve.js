const { sendError, sendSystem } = require('../core/protocol');
const { normalizeApproveMode, saveSessionMetadata } = require('../core/session');
const { pendingPermissionIds } = require('../core/permissionState');
const { agentRunner } = require('./common');

function handleApprove(mode, ws, session, config) {
  const value = String(mode || '').trim().toLowerCase();

  if (!value || value === 'status') {
    sendSystem(ws, [
      `审批模式当前为：${normalizeApproveMode(session.approveMode)}。`,
      '使用 /approve manual、/approve auto 或 /approve yolo 切换。默认 auto。',
      'manual: 手动确认权限请求；auto: 自动确认但保留默认权限边界；yolo: 跳过权限/沙箱限制。',
    ].join('\n'));
    return;
  }

  if (!['manual', 'auto', 'yolo'].includes(value)) {
    sendError(ws, '❌ /approve 参数只能是 manual、auto 或 yolo，例如 /approve auto。');
    return;
  }

  const previousMode = normalizeApproveMode(session.approveMode);
  session.approveMode = value;
  session.autoApprove = value !== 'manual';
  saveSessionMetadata(session);

  let approvedPending = 0;
  let approvedDanger = false;
  if (session.autoApprove) {
    const provider = session.agentType || 'claude';
    for (const requestId of pendingPermissionIds(session, provider)) {
      const resolved = agentRunner().resolvePendingPermission(true, ws, session, config, requestId);
      if (resolved) approvedPending += 1;
    }
    if (session.pendingDanger) {
      approvedDanger = !!agentRunner().resolvePendingDanger(true, ws, session, config);
    }
  }

  const shouldRestart = approveModeChangeRequiresRestart(previousMode, value, session);
  if (shouldRestart) {
    agentRunner().stopAgentProcess(session, { clearAgentSession: false });
  }

  const notes = [];
  if (approvedPending) notes.push(`已自动批准当前等待中的 ${approvedPending} 个权限请求。`);
  if (approvedDanger) notes.push('已自动批准当前等待中的危险操作确认。');
  if (shouldRestart) notes.push('当前 Agent 进程已停止；下一条消息会用新审批模式恢复同一会话。');

  sendSystem(ws, [`✅ 审批模式已切换：${previousMode} -> ${value}`, approveModeDescription(value), ...notes].join('\n'));
}

function approveModeDescription(mode) {
  if (mode === 'manual') return 'manual: 后续权限请求和危险操作确认会回到手动确认。';
  if (mode === 'yolo') return 'yolo: 后续会尽量使用 Agent 原生跳过权限/沙箱模式。';
  return 'auto: 后续权限请求和危险操作确认会自动允许，但保留默认权限边界。';
}

function approveModeChangeRequiresRestart(previousMode, nextMode, session) {
  if (previousMode === nextMode) return false;
  if (previousMode !== 'yolo' && nextMode !== 'yolo') return false;
  const agentType = session.agentType || 'claude';
  return agentType === 'claude' || agentType === 'codex';
}

module.exports = {
  handleApprove,
  approveModeDescription,
  approveModeChangeRequiresRestart,
};
