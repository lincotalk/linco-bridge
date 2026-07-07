const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { WebSocket } = require('ws');
const pkg = require('../../package.json');

const DEFAULT_GATEWAY_URL = 'ws://127.0.0.1:18789';
const DEFAULT_START_TIMEOUT_MS = 30000;
const DEFAULT_HEALTH_TIMEOUT_MS = 1500;
const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const REQUIRED_METHODS = [
  'sessions.create',
  'chat.send',
  'chat.abort',
  'sessions.messages.subscribe',
  'exec.approval.resolve',
  'plugin.approval.resolve',
];

const bootstrapPromises = new Map();
const ownedGateways = new Map();
let cleanupRegistered = false;

/**
 * Read gateway auth token from OpenClaw's default config file.
 * Respects OPENCLAW_STATE_DIR, OPENCLAW_CONFIG_PATH, and OPENCLAW_PROFILE env vars.
 */
function readOpenClawGatewayToken() {
  const profile = process.env.OPENCLAW_PROFILE || '';
  const configPath = process.env.OPENCLAW_CONFIG_PATH;
  if (configPath) {
    return extractTokenFromConfig(configPath);
  }
  const home = process.env.OPENCLAW_STATE_DIR || process.env.HOME || process.env.USERPROFILE || '';
  const stateDir = profile ? `${home}/.openclaw-${profile}` : `${home}/.openclaw`;
  return extractTokenFromConfig(path.join(stateDir, 'openclaw.json'));
}

function extractTokenFromConfig(configPath) {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const auth = config?.gateway?.auth;
    if (!auth) return undefined;
    const mode = (auth.mode || '').toLowerCase();
    if (mode === 'token') return auth.token || undefined;
    return undefined;
  } catch {
    return undefined;
  }
}

function normalizeGatewayUrl(value) {
  const raw = String(value || DEFAULT_GATEWAY_URL).trim() || DEFAULT_GATEWAY_URL;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`OpenClaw Gateway URL is invalid: ${raw}`);
  }
  if (parsed.protocol === 'http:') parsed.protocol = 'ws:';
  if (parsed.protocol === 'https:') parsed.protocol = 'wss:';
  if (!['ws:', 'wss:'].includes(parsed.protocol)) {
    throw new Error(`OpenClaw Gateway URL must use ws/http: ${raw}`);
  }
  return parsed.toString().replace(/\/+$/, '');
}

function resolveOpenClawGatewayUrl(agentConfig = {}) {
  if (agentConfig.gatewayUrl) return normalizeGatewayUrl(agentConfig.gatewayUrl);
  const port = process.env.OPENCLAW_GATEWAY_PORT || '18789';
  return normalizeGatewayUrl(`ws://127.0.0.1:${port}`);
}

function resolveOpenClawGatewayOptions(agentConfig = {}) {
  const gatewayUrl = resolveOpenClawGatewayUrl(agentConfig);
  const url = new URL(gatewayUrl);
  const openclawBin = agentConfig.bin || agentConfig.openclawBin || 'openclaw';
  const autoStartGateway = agentConfig.autoStartGateway !== false;
  const startTimeoutMs = Number(agentConfig.gatewayStartTimeoutMs) > 0
    ? Number(agentConfig.gatewayStartTimeoutMs)
    : DEFAULT_START_TIMEOUT_MS;
  return { gatewayUrl, host: url.hostname, openclawBin, autoStartGateway, startTimeoutMs };
}

async function ensureOpenClawGateway(agentConfig = {}, logger) {
  const options = resolveOpenClawGatewayOptions(agentConfig);
  const health = await checkGatewayHealth(options.gatewayUrl, agentConfig);
  if (health.ok) return options.gatewayUrl;

  if (!options.autoStartGateway) {
    throw new Error(`OpenClaw Gateway is not running at ${options.gatewayUrl}, and autoStartGateway=false.`);
  }
  if (!isLoopbackHost(options.host)) {
    throw new Error(`OpenClaw Gateway auto-start only supports loopback hosts: ${options.gatewayUrl}`);
  }

  const key = options.gatewayUrl;
  if (!bootstrapPromises.has(key)) {
    bootstrapPromises.set(key, bootstrapGateway(options, logger).finally(() => {
      bootstrapPromises.delete(key);
    }));
  }
  await bootstrapPromises.get(key);
  return options.gatewayUrl;
}

async function bootstrapGateway(options, logger) {
  logger?.info?.('openclaw gateway bootstrap starting', { gatewayUrl: options.gatewayUrl });
  const child = startGateway(options, logger);
  await waitForGatewayReady(options.gatewayUrl, {
    timeoutMs: options.startTimeoutMs,
    child,
  });
  logger?.info?.('openclaw gateway bootstrap ready', { gatewayUrl: options.gatewayUrl });
}

function startGateway(options, logger) {
  let child;
  try {
    child = spawn(options.openclawBin, ['gateway', 'run'], {
      stdio: 'ignore',
      windowsHide: true,
      env: process.env,
    });
  } catch (err) {
    if (err.code === 'ENOENT') throw openclawBinError(options.openclawBin);
    throw err;
  }

  if (!child.pid) throw openclawBinError(options.openclawBin);
  const record = { child, gatewayUrl: options.gatewayUrl, ready: false, earlyExit: null };
  ownedGateways.set(options.gatewayUrl, record);
  registerCleanup();

  child.once('error', err => {
    record.earlyExit = err;
    logger?.error?.('openclaw gateway process error', { error: err.message });
  });
  child.once('exit', (code, signal) => {
    if (!record.ready) record.earlyExit = new Error(`exit ${code ?? signal ?? 'unknown'}`);
    logger?.info?.('openclaw gateway process exited', { code, signal });
  });
  return child;
}

async function waitForGatewayReady(gatewayUrl, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_START_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const record = ownedGateways.get(normalizeGatewayUrl(gatewayUrl));
    if (record?.earlyExit) {
      if (record.earlyExit.code === 'ENOENT') throw openclawBinError(options.child?.spawnfile || 'openclaw');
      throw new Error('OpenClaw Gateway failed to start: openclaw gateway run exited early.');
    }
    if (options.child?.exitCode != null || options.child?.signalCode) {
      throw new Error('OpenClaw Gateway failed to start: openclaw gateway run exited early.');
    }
    const health = await checkGatewayHealth(gatewayUrl, {}, { timeoutMs: DEFAULT_HEALTH_TIMEOUT_MS });
    if (health.ok) {
      if (record) record.ready = true;
      return;
    }
    await delay(pollIntervalMs);
  }
  throw new Error(`OpenClaw Gateway startup timed out: ${normalizeGatewayUrl(gatewayUrl)} was not ready.`);
}

function checkGatewayHealth(gatewayUrl, _agentConfig = {}, options = {}) {
  const normalized = normalizeGatewayUrl(gatewayUrl);
  const timeoutMs = options.timeoutMs || DEFAULT_HEALTH_TIMEOUT_MS;
  return new Promise(resolve => {
    let settled = false;
    const ws = new WebSocket(normalized);
    const timer = setTimeout(() => finish({ ok: false, error: new Error('timeout') }), timeoutMs);
    timer.unref?.();

    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.terminate();
      } catch {}
      resolve(result);
    }

    ws.once('open', () => finish({ ok: true, error: null }));
    ws.once('error', err => finish({ ok: false, error: err }));
    ws.once('close', () => finish({ ok: false, error: new Error('closed') }));
  });
}

class OpenClawGatewayClient {
  constructor(options = {}) {
    this.url = normalizeGatewayUrl(options.url || options.gatewayUrl || DEFAULT_GATEWAY_URL);
    this.agentConfig = options.agentConfig || {};
    this.logger = options.logger;
    this.requestTimeoutMs = options.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
    this.pending = new Map();
    this.eventHandlers = new Set();
    this.closeHandlers = new Set();
    this.methods = new Set();
    this.hello = null;
    this.ws = null;
    this.connected = false;
    this.closed = false;
    this.closeNotified = false;
  }

  async connect() {
    if (this.connected) return this.hello;
    if (this.closed) throw new Error('OpenClaw Gateway client is closed.');

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      let connectSent = false;
      let helloResolved = false;
      const timer = setTimeout(() => {
        rejectOnce(new Error('OpenClaw Gateway connect timed out.'));
        try { ws.terminate(); } catch {}
      }, this.requestTimeoutMs);
      timer.unref?.();

      const rejectOnce = err => {
        if (helloResolved) return;
        helloResolved = true;
        clearTimeout(timer);
        reject(err);
      };

      ws.on('message', data => {
        let frame;
        try {
          frame = JSON.parse(data.toString());
        } catch {
          return;
        }

        if (frame.type === 'event' && frame.event === 'connect.challenge' && !connectSent) {
          connectSent = true;
          this.sendFrame(buildConnectRequest(frame.payload?.nonce, this.agentConfig));
          return;
        }

        if (frame.type === 'res' && frame.id === 'connect') {
          if (!frame.ok) {
            rejectOnce(new Error(formatGatewayError(frame.error)));
            return;
          }
          helloResolved = true;
          clearTimeout(timer);
          this.connected = true;
          this.closeNotified = false;
          this.hello = frame.payload || {};
          for (const method of this.hello.features?.methods || []) this.methods.add(method);
          resolve(this.hello);
          return;
        }

        this.handleFrame(frame);
      });

      ws.once('open', () => {});
      ws.once('error', err => {
        if (this.connected && !this.closed) this.notifyClose(err);
        rejectOnce(err);
      });
      ws.once('close', (code, reason) => {
        this.connected = false;
        const err = new Error(`OpenClaw Gateway closed: ${code} ${reason?.toString?.() || ''}`.trim());
        this.rejectAllPending(err);
        if (!this.closed) this.notifyClose(err);
        if (!helloResolved) rejectOnce(new Error(`OpenClaw Gateway closed before connect: ${code}`));
      });
    });
  }

  request(method, params = {}, options = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.connected) {
      return Promise.reject(new Error('OpenClaw Gateway is not connected.'));
    }
    const id = options.id || `${method}-${cryptoRandomId()}`;
    const timeoutMs = options.timeoutMs === null ? null : (options.timeoutMs || this.requestTimeoutMs);
    const frame = { type: 'req', id, method, params };
    return new Promise((resolve, reject) => {
      let timer = null;
      if (timeoutMs != null) {
        timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`OpenClaw Gateway request timed out: ${method}`));
        }, timeoutMs);
        timer.unref?.();
      }
      this.pending.set(id, { resolve, reject, timer, method });
      try {
        this.sendFrame(frame);
      } catch (err) {
        this.pending.delete(id);
        if (timer) clearTimeout(timer);
        reject(err);
      }
    });
  }

  supports(method) {
    return this.methods.size === 0 || this.methods.has(method);
  }

  requireMethods(methods) {
    const missing = methods.filter(method => !this.supports(method));
    if (missing.length > 0) {
      throw new Error(`OpenClaw Gateway is missing required methods: ${missing.join(', ')}`);
    }
  }

  onEvent(handler) {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onClose(handler) {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  close() {
    this.closed = true;
    this.connected = false;
    this.rejectAllPending(new Error('OpenClaw Gateway client closed.'));
    try {
      if (this.ws) this.ws.close();
    } catch {}
    this.ws = null;
    this.eventHandlers.clear();
    this.closeHandlers.clear();
  }

  handleFrame(frame) {
    if (frame?.type === 'res') {
      const pending = this.pending.get(frame.id);
      if (!pending) return;
      this.pending.delete(frame.id);
      if (pending.timer) clearTimeout(pending.timer);
      if (frame.ok) pending.resolve(frame.payload);
      else pending.reject(new Error(formatGatewayError(frame.error)));
      return;
    }

    if (frame?.type === 'event') {
      for (const handler of Array.from(this.eventHandlers)) {
        try {
          handler(frame.event, frame.payload, frame);
        } catch (err) {
          this.logger?.warn?.('openclaw event handler failed', { error: err.message });
        }
      }
    }
  }

  sendFrame(frame) {
    this.ws.send(JSON.stringify(frame));
  }

  rejectAllPending(err) {
    for (const [id, pending] of this.pending) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(err);
      this.pending.delete(id);
    }
  }

  notifyClose(err) {
    if (this.closeNotified) return;
    this.closeNotified = true;
    for (const handler of Array.from(this.closeHandlers)) {
      try {
        handler(err);
      } catch (handlerErr) {
        this.logger?.warn?.('openclaw close handler failed', { error: handlerErr.message });
      }
    }
  }
}

function buildConnectRequest(_nonce, agentConfig = {}) {
  const token = agentConfig.apiKey || readOpenClawGatewayToken();
  const auth = token ? { token } : undefined;
  return {
    type: 'req',
    id: 'connect',
    method: 'connect',
    params: {
      minProtocol: 4,
      maxProtocol: 4,
      client: {
        id: 'gateway-client',
        displayName: 'linco-connect',
        version: pkg.version,
        platform: process.platform,
        mode: 'backend',
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write', 'operator.approvals'],
      caps: ['tool-events'],
      commands: [],
      permissions: {},
      auth,
      locale: 'zh-CN',
      userAgent: `linco-connect/${pkg.version}`,
    },
  };
}

function formatGatewayError(error) {
  if (!error) return 'OpenClaw Gateway request failed.';
  if (typeof error === 'string') return error;
  return error.message || error.code || JSON.stringify(error);
}

function openclawBinError(openclawBin) {
  return new Error(`OpenClaw CLI not found: ${openclawBin}. Install OpenClaw or configure agents.openclaw.bin / LINCO_OPENCLAW_BIN.`);
}

function isLoopbackHost(host) {
  const value = String(host || '').toLowerCase();
  return value === 'localhost' || value === '127.0.0.1' || value === '::1' || value === '[::1]';
}

function registerCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  const cleanup = () => {
    for (const record of ownedGateways.values()) {
      try {
        if (record.child && !record.child.killed) record.child.kill();
      } catch {}
    }
  };
  process.once('exit', cleanup);
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      cleanup();
      process.kill(process.pid, signal);
    });
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cryptoRandomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = {
  DEFAULT_GATEWAY_URL,
  REQUIRED_METHODS,
  OpenClawGatewayClient,
  checkGatewayHealth,
  ensureOpenClawGateway,
  normalizeGatewayUrl,
  resolveOpenClawGatewayOptions,
};
