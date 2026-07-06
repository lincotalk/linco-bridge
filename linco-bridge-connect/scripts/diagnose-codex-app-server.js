const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const question = process.argv.slice(2).join(' ').trim() || '请用一句中文回答：你收到了吗？';
const workspace = process.cwd();
const bin = process.env.CODEX_BIN || 'codex';
const timeoutMs = Number(process.env.CODEX_DIAG_TIMEOUT_MS || 60000);

let rpcId = 0;
let stdoutBuffer = '';
let stderrBuffer = '';
let threadId = '';
let turnDone = false;
const pending = new Map();
const messages = [];

const spawnTarget = resolveCodexSpawnTarget(bin);
const child = spawn(spawnTarget.command, [...spawnTarget.argsPrefix, 'app-server', '--listen', 'stdio://'], {
  cwd: workspace,
  env: { ...process.env },
  shell: spawnTarget.shell,
  windowsHide: true,
  stdio: ['pipe', 'pipe', 'pipe'],
});

const timeout = setTimeout(() => {
  console.error(`diagnostic timed out after ${timeoutMs}ms`);
  finish(1);
}, timeoutMs);

child.stdout.setEncoding('utf8');
child.stdout.on('data', chunk => {
  stdoutBuffer += chunk;
  const lines = stdoutBuffer.split(/\r?\n/);
  stdoutBuffer = lines.pop() || '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      handleMessage(JSON.parse(trimmed));
    } catch (err) {
      console.log(JSON.stringify({ kind: 'unparseable', line: trimmed.slice(0, 500), error: err.message }));
    }
  }
});

child.stderr.setEncoding('utf8');
child.stderr.on('data', chunk => {
  stderrBuffer += chunk;
});

child.on('error', err => {
  console.error(`failed to start ${bin}: ${err.message}`);
  finish(1);
});

child.on('close', code => {
  if (!turnDone) {
    console.error(`codex app-server exited before turn completed, code=${code}`);
    if (stderrBuffer.trim()) console.error(stderrBuffer.trim());
    finish(code || 1);
  }
});

main().catch(err => {
  console.error(err.stack || err.message);
  finish(1);
});

async function main() {
  const init = await request('initialize', {
    clientInfo: { name: 'linco-diagnostic', version: '1.0.0' },
    capabilities: { experimentalApi: true },
  });
  console.log(JSON.stringify({ kind: 'initialize.result', keys: Object.keys(init || {}) }));

  const started = await request('thread/start', {
    cwd: workspace,
    model: null,
    approvalPolicy: 'untrusted',
    sandbox: 'workspace-write',
    config: {
      sandbox_mode: 'workspace-write',
      sandbox_workspace_write: {
        writable_roots: [workspace, path.join(os.tmpdir(), 'linco-codex-diagnostic')],
        network_access: false,
        exclude_tmpdir_env_var: false,
        exclude_slash_tmp: false,
      },
    },
  });
  threadId = started?.thread?.id || started?.id || started?.threadId || threadId;
  console.log(JSON.stringify({ kind: 'thread.started.result', threadId, keys: Object.keys(started || {}) }));

  send({
    jsonrpc: '2.0',
    id: nextId(),
    method: 'turn/start',
    params: {
      threadId,
      cwd: workspace,
      input: [{ type: 'text', text: question }],
    },
  });
}

function request(method, params) {
  const id = nextId();
  send({ jsonrpc: '2.0', id, method, params });
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
  });
}

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function resolveCodexSpawnTarget(command) {
  const fallback = command || 'codex';
  if (process.platform !== 'win32') {
    return { command: fallback, argsPrefix: [], shell: false };
  }

  const normalized = path.normalize(fallback);
  const lower = normalized.toLowerCase();

  if (lower.endsWith('.cmd') || lower.endsWith('.bat')) {
    const shimTarget = resolveNpmShimTarget(normalized);
    if (shimTarget) {
      return { command: process.execPath, argsPrefix: [shimTarget], shell: false };
    }

    return {
      command: process.env.ComSpec || 'cmd.exe',
      argsPrefix: ['/d', '/s', '/c', quoteCmdArg(normalized)],
      shell: false,
    };
  }

  if (lower.endsWith('.exe') || path.isAbsolute(normalized)) {
    return { command: normalized, argsPrefix: [], shell: false };
  }

  return { command: fallback, argsPrefix: [], shell: true };
}

function resolveNpmShimTarget(command) {
  try {
    const source = fs.readFileSync(command, 'utf8');
    const match = source.match(/"?%(?:~dp0|dp0%)\\([^"\r\n]+?\.(?:c?js|mjs))"?/i);
    if (!match) return null;
    const target = path.resolve(path.dirname(command), match[1]);
    return fs.existsSync(target) ? target : null;
  } catch {
    return null;
  }
}

function quoteCmdArg(value) {
  const text = String(value);
  if (!/[ \t&()^|<>"]/u.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function nextId() {
  rpcId += 1;
  return rpcId;
}

function handleMessage(message) {
  messages.push(message);
  console.log(JSON.stringify(summarizeMessage(message)));

  if (message.id != null && pending.has(message.id)) {
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result || message);
    return;
  }

  if (message.method === 'thread.started' || message.method === 'thread/start') {
    threadId = message.params?.thread?.id || message.params?.id || message.result?.thread?.id || threadId;
  }

  if (message.method === 'turn/completed' || message.method === 'turn.completed') {
    turnDone = true;
    finish(0);
  }
}

function summarizeMessage(message) {
  const params = message.params || {};
  const item = params.item || {};
  return {
    kind: message.id != null ? (message.method ? 'request' : 'response') : 'notification',
    id: message.id,
    method: message.method || '',
    paramKeys: Object.keys(params),
    itemType: item.type,
    itemPhase: item.phase,
    textPaths: collectTextPaths(message),
    itemKeys: item && typeof item === 'object' ? Object.keys(item) : [],
  };
}

function collectTextPaths(value, pathName = '$', out = []) {
  if (out.length >= 20 || value == null) return out;
  if (typeof value === 'string') {
    if (value.trim()) out.push({ path: pathName, value: value.slice(0, 200) });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectTextPaths(item, `${pathName}[${index}]`, out));
    return out;
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (/text|message|content|output|delta|final|phase|type/i.test(key)) {
        collectTextPaths(value[key], `${pathName}.${key}`, out);
      } else if (key === 'item' || key === 'params' || key === 'result') {
        collectTextPaths(value[key], `${pathName}.${key}`, out);
      }
    }
  }
  return out;
}

function finish(code) {
  clearTimeout(timeout);
  try {
    if (child.stdin && !child.stdin.destroyed) child.stdin.end();
  } catch {}
  try {
    if (!child.killed) child.kill();
  } catch {}
  process.exitCode = code;
}
