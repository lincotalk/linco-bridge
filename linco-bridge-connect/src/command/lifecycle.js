const { sendError, sendSystem } = require('../core/protocol');
const { handleHistory } = require('./history');
const { handleUpdate } = require('./update');
const {
  agentRunner,
  completeLocalCommand,
  completeMaybeAsyncLocalCommand,
} = require('./common');

function handleCompactCommand(rawArg, ws, session, config) {
  const agentType = session.agentType || 'claude';
  const mode = String(rawArg || '').trim().toLowerCase();
  if (mode && !['native'].includes(mode)) {
    sendError(ws, '/compact currently supports native mode only. Use /compact or /compact native.');
    return completeLocalCommand(ws, session);
  }
  const nativeCommand = agentType === 'hermes' ? '/compress' : '/compact';
  const handled = agentRunner().compactAgentContext(ws, session, config, { trigger: 'manual', nativeCommand });
  if (!handled) {
    sendError(ws, 'Current agent does not support /compact.');
    return completeLocalCommand(ws, session);
  }
  return true;
}

function handleReload(ws, session, config) {
  runReload(ws, session, config)
    .finally(() => {
      completeLocalCommand(ws, session);
    });
}

function runReload(ws, session, config) {
  const agentType = session.agentType || 'claude';
  const resumeId = session.agentSessionId || '';
  // history-reload 会先拉历史再 reload；强制杀进程，避免旧 app-server 残留写锁。
  agentRunner().stopAgentProcess(session, { clearAgentSession: false, forceKill: true });
  sendSystem(ws, [
    `🔄 已刷新当前 ${agentType} 会话。`,
    resumeId ? `保留的 Session ID: ${resumeId}` : '当前还没有可恢复的 Session ID。',
    '下次消息会重新加载本地 Agent 历史。'
  ].join('\n'));
  return warmupAfterReload(ws, session, config, agentType);
}

function isSoftWarmupFailure(err) {
  const code = String(err?.code || '').trim();
  const message = String(err?.message || err || '');
  return code === 'CODEX_THREAD_ACTIVE_WRITER'
    || /active writer/i.test(message)
    || /写入权仍被占用|跨端写入机制/.test(message);
}

async function warmupAfterReload(ws, session, config, agentType) {
  const delaysMs = [0, 400, 900];
  let lastError;
  for (let index = 0; index < delaysMs.length; index += 1) {
    const delayMs = delaysMs[index];
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      agentRunner().stopAgentProcess(session, { clearAgentSession: false, forceKill: true });
    }
    try {
      const result = await agentRunner().warmupAgentProcess(ws, session, config);
      if (result?.supported === false) {
        sendSystem(ws, `${agentType} 模式不支持空预启动，下次消息会按需启动。`);
        return;
      }
      sendSystem(ws, `${agentType} Agent 进程已预启动。`);
      return;
    } catch (err) {
      lastError = err;
      if (!isSoftWarmupFailure(err)) {
        sendError(ws, `${agentType} Agent 预启动失败: ${err.message}`);
        return;
      }
    }
  }

  // 预启动是 best-effort：active writer 瞬时冲突不应变成进房红条终态错误。
  // 历史已在 history-reload 前半段返回；真正发消息时还会再 resume。
  // 软失败后强制清掉可能半开着的 app-server，避免发消息时和自己抢写锁。
  agentRunner().stopAgentProcess(session, { clearAgentSession: false, forceKill: true });
  sendSystem(
    ws,
    `${agentType} 预启动暂未完成（会话写入权忙），历史已同步；发送消息时会再次尝试恢复会话。`,
  );
  return lastError;
}

function handleHistoryReload(rawArg, ws, session, config = {}) {
  if (isSessionBusyForHistoryReload(session)) {
    return completeLocalCommand(ws, session);
  }

  const agentType = session.agentType || 'claude';
  if (agentType === 'deepseek') {
    completeMaybeAsyncLocalCommand(handleHistory(rawArg, ws, session, {
      homeDir: config?.homeDir,
      config,
      bindExplicitHistorySession: true,
      allowExplicitHistorySessionSwitch: true,
      historyReload: true,
    }), ws, session);
    return true;
  }

  const trackingWs = trackHistoryResult(ws, { defer: true });
  const historyOptions = {
    homeDir: config?.homeDir,
    config,
    bindExplicitHistorySession: true,
    allowExplicitHistorySessionSwitch: true,
    historyReload: true,
  };

  if (agentType === 'codex') {
    completeMaybeAsyncLocalCommand(
      Promise.resolve(handleHistory(rawArg, trackingWs, session, historyOptions))
        .then(() => runReload(ws, session, config))
        .then(() => {
          trackingWs.flush();
        }),
      ws,
      session,
    );
    return true;
  }

  handleHistory(rawArg, trackingWs, session, historyOptions);

  runReload(ws, session, config)
    .then(() => {
      trackingWs.flush();
    })
    .finally(() => {
      completeLocalCommand(ws, session);
    });
  return true;
}

function isSessionBusyForHistoryReload(session) {
  return Boolean(
    session?.isTurnActive ||
    session?.claudeCompaction ||
    session?.codexCompaction ||
    session?.pendingCodexManualCompaction ||
    session?.pendingPermission ||
    session?.pendingDanger
  );
}

function trackHistoryResult(ws, options = {}) {
  const pending = [];
  return {
    ...ws,
    linco: ws?.linco,
    sawHistoryResult: false,
    send(raw) {
      try {
        const item = JSON.parse(raw);
        if (item?.type === 'slash_command_result' && item.command === 'history') {
          this.sawHistoryResult = true;
        }
      } catch {}
      if (options.defer) {
        pending.push(raw);
        return;
      }
      return ws.send(raw);
    },
    flush() {
      for (const raw of pending.splice(0)) {
        ws.send(raw);
      }
    },
  };
}

function handleUpdateCommand(rawArg, ws, session, config) {
  handleUpdate(rawArg, ws, session, config)
    .catch(err => {
      sendError(ws, `Linco Connect 升降级失败: ${err.message}`);
    })
    .finally(() => {
      completeLocalCommand(ws, session);
    });
}

module.exports = {
  handleCompactCommand,
  handleReload,
  runReload,
  warmupAfterReload,
  isSoftWarmupFailure,
  handleHistoryReload,
  isSessionBusyForHistoryReload,
  trackHistoryResult,
  handleUpdateCommand,
};
