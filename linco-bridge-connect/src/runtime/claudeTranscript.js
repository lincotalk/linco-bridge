const fs = require('fs');
const os = require('os');
const path = require('path');
const { encodeClaudeProjectDir } = require('./claudeProject');

const RETRY_DELAYS_MS = [200, 800, 2000, 5000, 10000];
const RECENT_MTIME_GRACE_MS = 300;

function resolveClaudeTranscriptPath(workspace, sessionId, homeDir = os.homedir()) {
  const projectDir = encodeClaudeProjectDir(workspace || process.cwd());
  return path.join(homeDir, '.claude', 'projects', projectDir, `${sessionId}.jsonl`);
}

function shouldRepairClaudeResumeEntrypoint(session, config = {}) {
  if ((session?.agentType || 'claude') !== 'claude') return false;
  if (config?.agents?.claude?.fixResumeEntrypoint === false) return false;
  if (!session.agentSessionId) return false;
  if (session.claudeResumeEntrypointFixedSessionId === session.agentSessionId) return false;
  return session.claudeResumeEntrypointFixPending === true || (session.messageCount || 0) <= 1;
}

function markClaudeResumeEntrypointFixPending(session, saveSessionMetadata) {
  if (!session || (session.agentType || 'claude') !== 'claude') return false;
  session.claudeResumeEntrypointFixPending = true;
  session.claudeResumeEntrypointFixedSessionId = null;
  persistMetadata(session, saveSessionMetadata);
  return true;
}

function markClaudeResumeEntrypointFixed(session, saveSessionMetadata) {
  if (!session?.agentSessionId) return;
  session.claudeResumeEntrypointFixPending = false;
  session.claudeResumeEntrypointFixedSessionId = session.agentSessionId;
  persistMetadata(session, saveSessionMetadata);
}

function repairClaudeResumeEntrypointNow(session, config = {}, options = {}) {
  if (!shouldRepairClaudeResumeEntrypoint(session, config)) {
    return { ok: true, skipped: true, reason: 'not_needed' };
  }

  const transcriptPath = resolveClaudeTranscriptPath(
    session.workspace || process.cwd(),
    session.agentSessionId,
    options.homeDir || os.homedir(),
  );
  const result = repairClaudeTranscriptFile(transcriptPath, {
    avoidRecentMtime: options.avoidRecentMtime === true,
    now: options.now,
  });

  if (result.ok) {
    markClaudeResumeEntrypointFixed(session, options.saveSessionMetadata);
  }
  return { ...result, transcriptPath };
}

function scheduleClaudeResumeEntrypointRepair(session, config = {}, options = {}) {
  const logger = config.logger;
  const attempt = Number(options.attempt || 0);
  const result = repairClaudeResumeEntrypointNow(session, config, {
    ...options,
    avoidRecentMtime: attempt > 0,
  });

  if (result.ok || result.skipped) {
    if (result.repaired) {
      logger?.info?.('claude resume entrypoint repaired', {
        sessionId: session.id,
        agentSessionId: session.agentSessionId,
        transcriptPath: result.transcriptPath,
      });
    }
    return result;
  }

  if (attempt >= RETRY_DELAYS_MS.length) {
    logger?.warn?.('claude resume entrypoint repair gave up', {
      sessionId: session.id,
      agentSessionId: session.agentSessionId || '',
      transcriptPath: result.transcriptPath,
      reason: result.reason,
    });
    return result;
  }

  const timer = setTimeout(() => {
    if (session.claudeResumeEntrypointFixedSessionId === session.agentSessionId) return;
    scheduleClaudeResumeEntrypointRepair(session, config, { ...options, attempt: attempt + 1 });
  }, RETRY_DELAYS_MS[attempt]);
  timer.unref?.();
  return result;
}

function repairClaudeTranscriptFile(filePath, options = {}) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return { ok: false, reason: 'missing_file' };
  }

  const now = Number(options.now || Date.now());
  if (options.avoidRecentMtime && now - stat.mtimeMs < RECENT_MTIME_GRACE_MS) {
    return { ok: false, reason: 'recently_modified' };
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return { ok: false, reason: 'read_failed', error: err.message };
  }

  const hasTrailingNewline = /\r?\n$/.test(content);
  const lines = content.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    let item;
    try {
      item = JSON.parse(line);
    } catch (err) {
      return { ok: false, reason: 'parse_failed', line: index + 1, error: err.message };
    }

    if (item?.type !== 'user') continue;
    if (item.entrypoint === 'cli') {
      return { ok: true, repaired: false, reason: 'already_cli', line: index + 1 };
    }
    if (item.entrypoint !== 'sdk-cli') {
      return { ok: true, repaired: false, reason: 'first_user_not_sdk_cli', line: index + 1 };
    }

    item.entrypoint = 'cli';
    lines[index] = JSON.stringify(item);
    try {
      writeFileAtomically(filePath, `${lines.join('\n')}${hasTrailingNewline ? '\n' : ''}`);
    } catch (err) {
      return { ok: false, reason: 'write_failed', line: index + 1, error: err.message };
    }
    return { ok: true, repaired: true, line: index + 1 };
  }

  return { ok: false, reason: 'missing_user_record' };
}

function writeFileAtomically(filePath, content) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

function persistMetadata(session, saveSessionMetadata) {
  if (typeof saveSessionMetadata !== 'function' || !session?.runtimeDir) return;
  try {
    saveSessionMetadata(session);
  } catch {}
}

module.exports = {
  encodeClaudeProjectDir,
  markClaudeResumeEntrypointFixPending,
  repairClaudeResumeEntrypointNow,
  repairClaudeTranscriptFile,
  resolveClaudeTranscriptPath,
  scheduleClaudeResumeEntrypointRepair,
  shouldRepairClaudeResumeEntrypoint,
};
