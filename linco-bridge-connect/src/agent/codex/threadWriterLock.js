'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

/**
 * Codex 对每个 thread 使用 ~/.codex/thread-writer-locks/<threadId>.lock。
 *
 * 重要：绝不能为了抢某一会话的写锁去杀掉 Codex Desktop 的 app-server。
 * Desktop 是多会话宿主，杀进程会让整个 ChatGPT/Codex 崩溃。
 *
 * 正确策略：
 * 1. 只清理 Linco/CLI 残留的孤儿 app-server（非 Desktop 安装目录）
 * 2. Desktop 仍占着该会话时，返回会话级占用提示，让用户在桌面端离开该会话
 * 3. App 自己持有写锁时，跳过二次 resume，避免自撞
 */

function resolveCodexHome(homeDir = os.homedir()) {
  const fromEnv = String(process.env.CODEX_HOME || '').trim();
  if (fromEnv) return fromEnv;
  return path.join(homeDir, '.codex');
}

function resolveThreadWriterLockPath(threadId, homeDir = os.homedir()) {
  const id = String(threadId || '').trim();
  if (!id) return '';
  return path.join(resolveCodexHome(homeDir), 'thread-writer-locks', `${id}.lock`);
}

function isCodexAppServerCommandLine(commandLine) {
  const text = String(commandLine || '');
  if (!/app-server/i.test(text)) return false;
  return /codex/i.test(text);
}

function isDesktopCodexAppServerCommandLine(commandLine) {
  const text = String(commandLine || '').replace(/\\/g, '/').toLowerCase();
  if (!isCodexAppServerCommandLine(text)) return false;
  return (
    text.includes('/openai/codex/')
    || text.includes('/openai\\codex/'.replace(/\\/g, '/'))
    || text.includes('appdata/local/openai/codex')
    || text.includes('chatgpt')
    || text.includes('codex desktop')
  );
}

function classifyCodexAppServerProcess(row) {
  const commandLine = String(row?.commandLine || '');
  if (!isCodexAppServerCommandLine(commandLine)) return 'other';
  if (isDesktopCodexAppServerCommandLine(commandLine)) return 'desktop';
  return 'orphan';
}

function listCodexAppServerProcesses() {
  if (process.platform === 'win32') {
    return listCodexAppServerProcessesWindows();
  }
  return listCodexAppServerProcessesUnix();
}

function listCodexAppServerProcessesWindows() {
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine | ConvertTo-Csv -NoTypeInformation',
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 20 * 1024 * 1024 },
  );
  if (result.status !== 0) return [];
  const lines = String(result.stdout || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return [];

  const rows = [];
  for (const line of lines.slice(1)) {
    const parsed = parseCsvLine(line);
    if (parsed.length < 3) continue;
    const pid = Number(parsed[0]);
    const name = String(parsed[1] || '');
    const commandLine = String(parsed[2] || '');
    if (!Number.isInteger(pid) || pid <= 0) continue;
    if (!isCodexAppServerCommandLine(commandLine)) continue;
    rows.push({
      pid,
      name,
      commandLine,
      kind: classifyCodexAppServerProcess({ commandLine }),
    });
  }
  return rows;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const ch = line[index];
    if (ch === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  values.push(current);
  return values;
}

function listCodexAppServerProcessesUnix() {
  const result = spawnSync('ps', ['-Ao', 'pid=,command='], {
    encoding: 'utf8',
    timeout: 5000,
  });
  if (result.status !== 0) return [];
  return String(result.stdout || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = /^(\d+)\s+(.*)$/.exec(line);
      if (!match) return null;
      const commandLine = match[2];
      return {
        pid: Number(match[1]),
        name: '',
        commandLine,
        kind: classifyCodexAppServerProcess({ commandLine }),
      };
    })
    .filter(row => row && Number.isInteger(row.pid) && row.pid > 0 && isCodexAppServerCommandLine(row.commandLine));
}

function forceKillPid(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  if (pid === process.pid) return false;
  try {
    if (process.platform === 'win32') {
      const result = spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
        timeout: 5000,
      });
      return result.status === 0;
    }
    process.kill(pid, 'SIGKILL');
    return true;
  } catch {
    return false;
  }
}

function tryRemoveThreadWriterLock(threadId, homeDir = os.homedir()) {
  const lockPath = resolveThreadWriterLockPath(threadId, homeDir);
  if (!lockPath) return false;
  try {
    if (!fs.existsSync(lockPath)) return false;
    fs.unlinkSync(lockPath);
    return true;
  } catch {
    return false;
  }
}

function isRunningUnderNodeTest() {
  if (typeof process.env.NODE_TEST !== 'undefined') return true;
  return process.execArgv.some(arg => arg === '--test' || arg.startsWith('--test'));
}

function inspectCodexThreadWriterCompetitors({
  keepPids = [],
} = {}) {
  const keep = new Set(
    (Array.isArray(keepPids) ? keepPids : [])
      .map(value => Number(value))
      .filter(pid => Number.isInteger(pid) && pid > 0),
  );
  keep.add(process.pid);

  const processes = listCodexAppServerProcesses().filter(row => !keep.has(row.pid));
  const desktop = processes.filter(row => row.kind === 'desktop');
  const orphans = processes.filter(row => row.kind === 'orphan');
  return { desktop, orphans, processes };
}

/**
 * 仅清理非 Desktop 的孤儿 app-server，绝不杀 Codex Desktop。
 * Desktop 仍占用该会话时，由上层返回会话级占用提示。
 */
function reclaimOrphanCodexWriters({
  threadId,
  keepPids = [],
  homeDir = os.homedir(),
  logger = null,
} = {}) {
  if (isRunningUnderNodeTest()) {
    return {
      killed: [],
      removedLock: false,
      desktopHolders: [],
      skipped: 'node_test',
    };
  }
  if (process.env.LINCO_CODEX_DISABLE_WRITER_TAKEOVER === '1') {
    return {
      killed: [],
      removedLock: false,
      desktopHolders: [],
      skipped: 'disabled',
    };
  }

  const { desktop, orphans } = inspectCodexThreadWriterCompetitors({ keepPids });
  const killed = [];
  for (const row of orphans) {
    const ok = forceKillPid(row.pid);
    if (ok) killed.push(row.pid);
    logger?.warn?.('codex cleared orphan app-server (non-desktop)', {
      threadId,
      pid: row.pid,
      ok,
      commandLine: String(row.commandLine || '').slice(0, 180),
    });
  }

  // 只有确认没有 Desktop 占锁时，才尝试删 stale lock；Desktop 活着时删了也无用且可能误导。
  let removedLock = false;
  if (desktop.length === 0) {
    removedLock = tryRemoveThreadWriterLock(threadId, homeDir);
    if (removedLock) {
      logger?.info?.('codex removed stale thread lock file', { threadId });
    }
  } else {
    logger?.info?.('codex desktop still holds app-server; skip killing desktop and lock file', {
      threadId,
      desktopPids: desktop.map(row => row.pid),
    });
  }

  return {
    killed,
    removedLock,
    desktopHolders: desktop.map(row => row.pid),
    skipped: null,
  };
}

// 兼容旧名：禁止再“抢 Desktop”，语义改为只清孤儿。
function reclaimCodexThreadWriter(options) {
  return reclaimOrphanCodexWriters(options);
}

module.exports = {
  classifyCodexAppServerProcess,
  forceKillPid,
  inspectCodexThreadWriterCompetitors,
  isCodexAppServerCommandLine,
  isDesktopCodexAppServerCommandLine,
  listCodexAppServerProcesses,
  reclaimCodexThreadWriter,
  reclaimOrphanCodexWriters,
  resolveCodexHome,
  resolveThreadWriterLockPath,
  tryRemoveThreadWriterLock,
};
