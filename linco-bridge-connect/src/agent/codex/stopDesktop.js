'use strict';

const { spawnSync } = require('node:child_process');
const {
  forceKillPid,
  isDesktopCodexAppServerCommandLine,
  listCodexAppServerProcesses,
  tryRemoveThreadWriterLock,
} = require('./threadWriterLock');

const STOP_DESKTOP_CONFIRM_MESSAGE = [
  '将关闭本机 Codex/ChatGPT 桌面端，以释放当前会话写锁。',
  '',
  '注意：关闭桌面端后，桌面端里所有会话都会退出，正在运行的其他任务也会停止。',
  '',
  '若确认，请再发送：/stop desktop confirm',
].join('\n');

function isRunningUnderNodeTest() {
  if (typeof process.env.NODE_TEST !== 'undefined') return true;
  return process.execArgv.some((arg) => arg === '--test' || arg.startsWith('--test'));
}

function parseStopDesktopArg(rawArg) {
  const text = String(rawArg || '').trim().toLowerCase();
  if (!text) return { kind: 'none' };
  if (text === 'desktop') return { kind: 'prompt' };
  if (text === 'desktop confirm') return { kind: 'confirm' };
  if (text.startsWith('desktop')) return { kind: 'usage' };
  return { kind: 'none' };
}

function isDesktopCodexUiProcess(row) {
  const name = String(row?.name || '').toLowerCase();
  const commandLine = String(row?.commandLine || '').replace(/\\/g, '/').toLowerCase();
  if (name === 'chatgpt.exe') return true;
  if (commandLine.includes('windowsapps/openai.codex') && /\.exe$/i.test(name)) return true;
  if (
    name === 'codex.exe'
    && commandLine.includes('appdata/local/openai/codex')
    && !/app-server/i.test(commandLine)
  ) {
    return true;
  }
  return false;
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

function listDesktopCodexUiProcessesWindows() {
  const script = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    '$rows = Get-CimInstance Win32_Process | Where-Object {',
    "  $name = [string]$_.Name",
    '  $cmd = [string]$_.CommandLine',
    "  if ($name -ieq 'ChatGPT.exe') { return $true }",
    "  if ($cmd -and ($cmd -match 'WindowsApps[\\\\/]+OpenAI\\\\.Codex')) { return $true }",
    '  return $false',
    '}',
    '$rows | Select-Object ProcessId,Name,CommandLine | ConvertTo-Csv -NoTypeInformation',
  ].join('; ');

  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  if (result.status !== 0) return [];
  const lines = String(result.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
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
    const row = { pid, name, commandLine, kind: 'desktop-ui' };
    if (!isDesktopCodexUiProcess(row)) continue;
    rows.push(row);
  }
  return rows;
}

function listDesktopCodexUiProcessesUnix() {
  const result = spawnSync('ps', ['-Ao', 'pid=,comm=,command='], {
    encoding: 'utf8',
    timeout: 5000,
  });
  if (result.status !== 0) return [];
  return String(result.stdout || '')
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(\d+)\s+(\S+)\s+(.*)$/.exec(line);
      if (!match) return null;
      return {
        pid: Number(match[1]),
        name: match[2],
        commandLine: match[3],
        kind: 'desktop-ui',
      };
    })
    .filter((row) => row && Number.isInteger(row.pid) && row.pid > 0 && isDesktopCodexUiProcess(row));
}

function listDesktopCodexUiProcesses() {
  if (process.platform === 'win32') return listDesktopCodexUiProcessesWindows();
  return listDesktopCodexUiProcessesUnix();
}

function collectDesktopCodexTargets() {
  const byPid = new Map();
  for (const row of listCodexAppServerProcesses()) {
    if (row.kind !== 'desktop' && !isDesktopCodexAppServerCommandLine(row.commandLine)) continue;
    byPid.set(row.pid, {
      pid: row.pid,
      name: row.name || '',
      commandLine: row.commandLine || '',
      kind: 'desktop-app-server',
    });
  }
  for (const row of listDesktopCodexUiProcesses()) {
    byPid.set(row.pid, row);
  }
  return [...byPid.values()];
}

function stopDesktopCodex({
  threadId = '',
  homeDir,
  logger = null,
} = {}) {
  if (isRunningUnderNodeTest()) {
    return {
      skipped: 'node_test',
      targets: [],
      killed: [],
      removedLock: false,
    };
  }

  const targets = collectDesktopCodexTargets();
  const killed = [];
  for (const row of targets) {
    const ok = forceKillPid(row.pid);
    if (ok) killed.push(row.pid);
    logger?.warn?.('codex desktop stop requested', {
      pid: row.pid,
      ok,
      kind: row.kind,
      commandLine: String(row.commandLine || '').slice(0, 180),
    });
  }

  let removedLock = false;
  if (threadId) {
    removedLock = tryRemoveThreadWriterLock(threadId, homeDir);
  }

  return {
    skipped: null,
    targets,
    killed,
    removedLock,
  };
}

function buildStopDesktopResultMessage(result) {
  if (result?.skipped === 'node_test') {
    return '测试环境已跳过关闭 Codex 桌面端。';
  }
  const killedCount = Array.isArray(result?.killed) ? result.killed.length : 0;
  if (killedCount > 0) {
    return `已关闭 Codex/ChatGPT 桌面端（结束 ${killedCount} 个进程）。写锁应已释放，可直接发消息继续。`;
  }
  return '未检测到正在运行的 Codex/ChatGPT 桌面端。若仍提示写入权占用，请再发一条消息重试。';
}

module.exports = {
  STOP_DESKTOP_CONFIRM_MESSAGE,
  buildStopDesktopResultMessage,
  collectDesktopCodexTargets,
  isDesktopCodexUiProcess,
  parseStopDesktopArg,
  stopDesktopCodex,
};
