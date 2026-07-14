
const { createHash } = require('node:crypto');
const { buildPcResumeCommand } = require('../pc');
const { projectAction, quoteProjectPath } = require('../project');
const {
  formatDateTime,
  timestampToMs,
  truncateText,
} = require('./utils');

function formatLocalProjectSessions(agentType, workspace, sessions, requestedLimit) {
  const lines = sessions.map((item, index) => {
    const command = buildPcResumeCommand(agentType, workspace, item.id);
    const title = truncateText(item.title || item.firstMessage || item.id, 80);
    return [
      `${index + 1}. ${title}`,
      `   ID: ${item.id}`,
      `   更新时间: ${formatDateTime(item.updatedAt)}`,
      `   恢复: ${command.text}`,
    ].join('\n');
  });
  return `当前工作目录最近 ${sessions.length} 个 ${agentType} session（请求 ${requestedLimit} 个）：\n${workspace}\n\n${lines.join('\n\n')}`;
}

function buildSessionsPayload(agentType, workspace, sessions, actions, requestedLimit) {
  return {
    version: 1,
    agentType,
    workspace,
    requestedLimit,
    returnedCount: sessions.length,
    items: sessions.map((item, index) => {
      const resumeCommand = buildPcResumeCommand(agentType, workspace, item.id);
      return {
        index: index + 1,
        id: item.id,
        title: item.title || item.firstMessage || item.id,
        firstMessage: item.firstMessage || '',
        lastMessage: item.lastMessage || '',
        updatedAt: item.updatedAt || 0,
        updatedAtText: formatDateTime(item.updatedAt),
        transcriptPath: item.transcriptPath || '',
        bindCommand: actions[index]?.command || `/bind ${quoteProjectPath(item.id)}`,
        resumeCommand,
      };
    }),
  };
}

function buildChatsPayload(chats, actions, requestedLimit) {
  return {
    version: 1,
    agentType: 'codex',
    requestedLimit,
    returnedCount: chats.length,
    items: chats.map((item, index) => ({
      index: index + 1,
      id: item.id,
      title: item.title || item.firstMessage || item.id,
      firstMessage: item.firstMessage || '',
      workspace: item.workspace || '',
      updatedAt: item.updatedAt || 0,
      updatedAtText: formatDateTime(item.updatedAt),
      transcriptPath: item.transcriptPath || '',
      source: item.source || 'codex-chats',
      historyCommand: `/history --chat ${quoteProjectPath(item.id)}`,
      bindCommand: actions[index]?.command || `/bind --chat ${quoteProjectPath(item.id)}`,
      resumeCommand: item.workspace ? buildPcResumeCommand('codex', item.workspace, item.id) : null,
    })),
  };
}

function formatHistoryRounds(agentType, sessionId, rounds, requestedLimit) {
  const lines = rounds.map((round, index) => {
    const user = round.user || '(无用户输入)';
    const assistant = round.assistant || '(无最终输出)';
    return [
      `${index + 1}. User`,
      user,
      '',
      'Assistant',
      assistant,
    ].join('\n');
  });
  return `当前 ${agentType} session 最近 ${rounds.length} 轮聊天（请求 ${requestedLimit} 轮）：\nAgent session: ${sessionId}\n\n${lines.join('\n\n')}`;
}

function mapRoundFiles(files) {
  if (!Array.isArray(files) || files.length === 0) return undefined;
  return files.map((file, index) => ({
    name: file.name || file.mediaName || `attachment-${index + 1}`,
    mimeType: file.mimeType || file.type || file.mediaType || 'application/octet-stream',
    base64: file.base64 || file.mediaBase64 || undefined,
    url: file.url || file.mediaUrl || undefined,
  }));
}

function stableHistoryRoundIdentity(agentType, sessionId, round, ordinal) {
  const normalizedUser = String(round.user || '').replace(/\s+/gu, ' ').trim();
  const userTimestampMs = timestampToMs(round.userTimestamp) || 0;
  const digest = createHash('sha256')
    .update(JSON.stringify([
      String(agentType || ''),
      String(sessionId || ''),
      userTimestampMs,
      normalizedUser,
      ordinal,
    ]))
    .digest('hex')
    .slice(0, 24);
  const sessionToken = Buffer.from(String(sessionId || ''), 'utf8').toString('base64url');
  return {
    roundId: `bridge_round_${digest}`,
    messageIdPrefix: `bridge_history_v2:${sessionToken}:${digest}`,
  };
}

function buildHistoryPayload(agentType, sessionId, requestedLimit, rounds, options = {}) {
  return {
    version: 2,
    agentType,
    agentSessionId: sessionId,
    workspace: options.workspace || undefined,
    replaceConversation: options.replaceConversation === true,
    switchedSession: options.switchedSession === true,
    requestedLimit,
    returnedRounds: rounds.length,
    rounds: rounds.map((round, index) => {
      const ordinal = Number.isInteger(round.ordinal) && round.ordinal > 0
        ? round.ordinal
        : index + 1;
      const identity = stableHistoryRoundIdentity(
        agentType,
        sessionId,
        round,
        ordinal,
      );
      return {
        index: index + 1,
        ordinal,
        roundId: identity.roundId,
        timestamp: round.userTimestamp || round.assistantTimestamp || null,
        timestampMs: timestampToMs(round.userTimestamp || round.assistantTimestamp),
        user: {
          messageId: `${identity.messageIdPrefix}:user`,
          text: round.user || '',
          timestamp: round.userTimestamp || null,
          timestampMs: timestampToMs(round.userTimestamp),
          files: mapRoundFiles(round.userFiles),
        },
        assistant: {
          messageId: round.assistant
            ? `${identity.messageIdPrefix}:assistant`
            : undefined,
          text: round.assistant || '',
          missing: !round.assistant,
          timestamp: round.assistantTimestamp || null,
          timestampMs: timestampToMs(round.assistantTimestamp),
          files: mapRoundFiles(round.assistantFiles),
        },
      };
    }),
  };
}

function buildBindActions(sessions, workspace = '') {
  return sessions.map((item, index) => {
    const command = workspace
      ? `/bind --project ${quoteProjectPath(workspace)} ${quoteProjectPath(item.id)}`
      : `/bind ${quoteProjectPath(item.id)}`;
    return projectAction(`Bind session ${index + 1}`, command, {
      action: 'bind',
      agentSessionId: item.id,
      sessionId: item.id,
      path: workspace || undefined,
    });
  });
}

function buildChatBindActions(chats) {
  return chats.map((item, index) => projectAction(`Bind chat ${index + 1}`, `/bind --chat ${quoteProjectPath(item.id)}`, {
    action: 'bind',
    agentSessionId: item.id,
    sessionId: item.id,
    chatId: item.id,
    path: item.workspace || undefined,
  }));
}

module.exports = {
  buildBindActions,
  buildChatBindActions,
  buildChatsPayload,
  buildHistoryPayload,
  buildSessionsPayload,
  formatHistoryRounds,
  formatLocalProjectSessions,
};
