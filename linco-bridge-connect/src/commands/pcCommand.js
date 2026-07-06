const fs = require('fs');
const os = require('os');
const path = require('path');
const { sendError, sendSystem } = require('../core/protocol');
const { saveSessionMetadata } = require('../core/session');
const { repairClaudeResumeEntrypointNow } = require('../runtime/claudeTranscript');
const { encodeClaudeProjectDir } = require('./project');
const { buildPcResumeCommand } = require('./pc');

function handlePc(ws, session, config = {}) {
  const agentType = session.agentType || 'claude';
  if (!['claude', 'codex'].includes(agentType)) {
    sendError(ws, `/pc 目前只支持 Claude 和 Codex 模式，当前是 ${agentType}。`);
    return;
  }

  const resumeId = session.agentSessionId;
  if (!resumeId) {
    sendError(ws, `当前还没有 ${agentType} Session ID。请先发送一条消息建立会话后再使用 /pc。`);
    return;
  }

  const workspace = session.workspace || process.cwd();
  const command = buildPcResumeCommand(agentType, workspace, resumeId);
  const details = [`工作目录: ${workspace}`];

  if (agentType === 'claude') {
    repairClaudeResumeEntrypointNow(session, config, { saveSessionMetadata, homeDir: config.homeDir });
    const transcriptPath = resolveClaudeTranscriptPath(workspace, resumeId, config.homeDir);
    const transcriptStatus = fs.existsSync(transcriptPath) ? 'Claude 历史文件' : 'Claude 历史文件（预计位置，当前未检测到）';
    details.push(`${transcriptStatus}: ${transcriptPath}`);
  } else if (agentType === 'codex') {
    details.push('如果该 app-server 会话 ID 不能被 Codex TUI 直接恢复，可以在 PC 端改用 `codex resume --last --include-non-interactive` 选择最近会话。');
  }

  sendSystem(ws, [
    `💻 PC 端可以复制下面的命令打开当前 ${agentType} 会话：`,
    '',
    `\`\`\`${command.language}`,
    command.text,
    '```',
    '',
    ...details,
    '',
    'PC 端聊完后，回到 IM 发送 /reload，再继续提问。'
  ].join('\n'));
}

function resolveClaudeTranscriptPath(workspace, sessionId, homeDir = os.homedir()) {
  const projectDir = encodeClaudeProjectDir(workspace || process.cwd());
  return path.join(homeDir, '.claude', 'projects', projectDir, `${sessionId}.jsonl`);
}

module.exports = {
  handlePc,
  resolveClaudeTranscriptPath,
};
