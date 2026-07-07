const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const YAML = require('yaml');

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:8642';
const DEFAULT_GATEWAY_HOST = '127.0.0.1';
const DEFAULT_GATEWAY_PORT = 8642;
const DEFAULT_START_TIMEOUT_MS = 30000;
const DEFAULT_HEALTH_TIMEOUT_MS = 1500;
const DEFAULT_POLL_INTERVAL_MS = 500;

const bootstrapPromises = new Map();
const ownedGateways = new Map();
let cleanupRegistered = false;

function normalizeGatewayUrl(value) {
  const raw = String(value || DEFAULT_GATEWAY_URL).trim() || DEFAULT_GATEWAY_URL;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Hermes Gateway 地址无效：${raw}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Hermes Gateway 地址无效：${raw}`);
  }
  return parsed.toString().replace(/\/+$/, '');
}

function resolveHermesGatewayOptions(agentConfig = {}) {
  const requestedProfile = agentConfig.profile || process.env.LINCO_HERMES_PROFILE || 'default';
  const profileResolution = resolveHermesProfile({ ...agentConfig, profile: requestedProfile });
  const profile = profileResolution.profile;
  const profileDir = profileResolution.profileDir;
  let gatewayUrl = normalizeGatewayUrl(agentConfig.gatewayUrl || agentConfig.baseUrl || DEFAULT_GATEWAY_URL);
  const hermesBin = resolveHermesBin(agentConfig);
  const autoStartGateway = agentConfig.autoStartGateway !== false;
  if (shouldUseProfileScopedGateway(agentConfig, profile, gatewayUrl, autoStartGateway)) {
    gatewayUrl = profileScopedGatewayUrl(gatewayUrl, profile);
  }
  const url = new URL(gatewayUrl);
  const host = url.hostname || DEFAULT_GATEWAY_HOST;
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : DEFAULT_GATEWAY_PORT));
  const startTimeoutMs = Number(agentConfig.gatewayStartTimeoutMs) > 0
    ? Number(agentConfig.gatewayStartTimeoutMs)
    : DEFAULT_START_TIMEOUT_MS;

  return {
    gatewayUrl,
    host,
    port,
    profile,
    requestedProfile: profileResolution.requestedProfile,
    profileDir,
    hermesBin,
    autoStartGateway,
    startTimeoutMs,
  };
}

function resolveHermesBin(agentConfig = {}) {
  return process.env.LINCO_HERMES_BIN
    || process.env.HERMES_BIN
    || agentConfig.hermesBin
    || agentConfig.bin
    || 'hermes';
}

function resolveHermesProfileDir(agentConfig = {}) {
  return resolveHermesProfile(agentConfig).profileDir;
}

function resolveHermesProfile(agentConfig = {}) {
  const baseHome = path.resolve(
    agentConfig.hermesHome
    || process.env.LINCO_HERMES_HOME
    || process.env.HERMES_HOME
    || defaultHermesHome()
  );
  const requestedProfile = normalizeProfileName(agentConfig.profile || process.env.LINCO_HERMES_PROFILE || 'default');
  if (isProfileHome(baseHome) && requestedProfile === 'default') {
    return {
      requestedProfile,
      profile: normalizeProfileName(path.basename(baseHome)),
      profileDir: baseHome,
      baseHome: activeProfileBase(baseHome),
    };
  }
  const activeBase = activeProfileBase(baseHome);
  const profile = requestedProfile === 'default'
    ? readActiveHermesProfile(activeBase)
    : requestedProfile;
  const profileDir = profile === 'default' ? activeBase : path.join(activeBase, 'profiles', profile);
  return { requestedProfile, profile, profileDir, baseHome: activeBase };
}

function defaultHermesHome() {
  return path.join(os.homedir(), '.hermes');
}

function activeProfileBase(baseHome) {
  const normalized = path.resolve(baseHome);
  if (isProfileHome(normalized)) {
    return path.dirname(path.dirname(normalized));
  }
  return normalized;
}

function isProfileHome(baseHome) {
  return path.basename(path.dirname(path.resolve(baseHome))).toLowerCase() === 'profiles';
}

function readActiveHermesProfile(baseHome) {
  const file = path.join(baseHome, 'active_profile');
  try {
    const name = normalizeProfileName(fs.readFileSync(file, 'utf8'));
    return name || 'default';
  } catch {
    return 'default';
  }
}

function normalizeProfileName(value) {
  const name = String(value || 'default').trim().toLowerCase();
  return name || 'default';
}

function shouldUseProfileScopedGateway(agentConfig = {}, profile, gatewayUrl, autoStartGateway) {
  const profileName = String(profile || 'default').trim() || 'default';
  if (profileName === 'default') return false;
  if (autoStartGateway === false) return false;
  if (agentConfig.profileScopedGateway === false) return false;
  if (isFalseEnv(process.env.LINCO_HERMES_PROFILE_SCOPED_GATEWAY)) return false;

  let parsed;
  try {
    parsed = new URL(normalizeGatewayUrl(gatewayUrl));
  } catch {
    return false;
  }
  return isLoopbackHost(parsed.hostname || DEFAULT_GATEWAY_HOST);
}

function profileScopedGatewayUrl(gatewayUrl, profile) {
  const parsed = new URL(normalizeGatewayUrl(gatewayUrl));
  const basePort = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : DEFAULT_GATEWAY_PORT));
  parsed.port = String(profileScopedPort(basePort, profile));
  return parsed.toString().replace(/\/+$/, '');
}

function profileScopedPort(basePort, profile) {
  const hash = crypto.createHash('sha1').update(String(profile || '')).digest();
  const offset = (hash.readUInt16BE(0) % 1000) + 1;
  return basePort + offset;
}

function isFalseEnv(value) {
  return /^(0|false|no|off)$/i.test(String(value || '').trim());
}

async function ensureHermesGateway(agentConfig = {}, logger) {
  const options = resolveHermesGatewayOptions(agentConfig);
  applyHermesApiKeyFromProfile(agentConfig, options.profileDir);
  let health = await checkGatewayHealth(options.gatewayUrl, agentConfig);
  if (health.authFailed && !agentConfig.apiKey) {
    const configKey = readApiServerKey(options.profileDir);
    if (configKey) {
      agentConfig.apiKey = configKey;
      health = await checkGatewayHealth(options.gatewayUrl, agentConfig);
    }
  }
  if (health.ok) return options.gatewayUrl;
  if (health.authFailed) throw authError();
  if (!options.autoStartGateway) {
    throw new Error(`Hermes Gateway 未运行：${options.gatewayUrl}。当前 autoStartGateway=false，请启动外部 Gateway 或启用自动启动。`);
  }
  if (!isLoopbackHost(options.host)) {
    throw new Error(`Hermes Gateway 自动启动仅支持本机地址：${options.gatewayUrl}。请使用 127.0.0.1/localhost，或设置 autoStartGateway=false 使用外部 Gateway。`);
  }

  const key = `${options.gatewayUrl}:${options.profileDir}`;
  if (!bootstrapPromises.has(key)) {
    bootstrapPromises.set(key, bootstrapGateway(options, agentConfig, logger).finally(() => {
      bootstrapPromises.delete(key);
    }));
  }
  await bootstrapPromises.get(key);
  return options.gatewayUrl;
}

async function bootstrapGateway(options, agentConfig, logger) {
  logger?.info?.('hermes gateway bootstrap starting', {
    gatewayUrl: options.gatewayUrl,
    profile: options.profile,
    profileDir: options.profileDir,
  });

  const apiKey = ensureApiServerConfig({ profileDir: options.profileDir, host: options.host, port: options.port, apiKey: agentConfig.apiKey });
  const gatewayAgentConfig = { ...agentConfig, apiKey };
  if (!agentConfig.apiKey) agentConfig.apiKey = apiKey;
  cleanStaleGatewayLock(options.profileDir, logger);
  const child = startGateway({
    hermesBin: options.hermesBin,
    profileDir: options.profileDir,
    gatewayUrl: options.gatewayUrl,
    host: options.host,
    port: options.port,
    apiKey,
    logger,
  });
  await waitForGatewayReady(options.gatewayUrl, gatewayAgentConfig, {
    timeoutMs: options.startTimeoutMs,
    child,
  });
  logger?.info?.('hermes gateway bootstrap ready', { gatewayUrl: options.gatewayUrl });
}

async function checkGatewayHealth(gatewayUrl, agentConfig = {}, options = {}) {
  const normalized = normalizeGatewayUrl(gatewayUrl);
  const timeoutMs = options.timeoutMs || DEFAULT_HEALTH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${normalized}/health`, {
      method: 'GET',
      headers: buildHealthHeaders(agentConfig),
      signal: controller.signal,
    });
    return {
      ok: response.ok,
      status: response.status,
      authFailed: response.status === 401,
      error: null,
    };
  } catch (err) {
    return { ok: false, status: null, authFailed: false, error: err };
  } finally {
    clearTimeout(timer);
  }
}

function buildHealthHeaders(agentConfig) {
  const headers = { Accept: 'application/json' };
  if (agentConfig.apiKey) headers.Authorization = `Bearer ${agentConfig.apiKey}`;
  return headers;
}

function ensureApiServerConfig({ profileDir, host, port, apiKey }) {
  fs.mkdirSync(profileDir, { recursive: true });
  const configFile = path.join(profileDir, 'config.yaml');
  let cfg = {};
  if (fs.existsSync(configFile)) {
    try {
      cfg = YAML.parse(fs.readFileSync(configFile, 'utf8')) || {};
    } catch (err) {
      throw new Error(`无法读取 Hermes 配置文件：${configFile}。${err.message}`);
    }
  }

  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) cfg = {};
  cfg.platforms = objectValue(cfg.platforms);
  cfg.platforms.api_server = objectValue(cfg.platforms.api_server);
  const apiServer = cfg.platforms.api_server;
  apiServer.extra = objectValue(apiServer.extra);

  apiServer.enabled = true;
  if (apiServer.key == null || apiServer.key === '') apiServer.key = apiKey || crypto.randomBytes(24).toString('hex');
  apiServer.extra.key = apiServer.key;
  apiServer.cors_origins = apiServer.cors_origins || 'http://127.0.0.1:*';
  apiServer.extra.host = host;
  apiServer.extra.port = port;
  delete apiServer.host;
  delete apiServer.port;

  try {
    fs.writeFileSync(configFile, YAML.stringify(cfg, { lineWidth: 0 }));
  } catch (err) {
    throw new Error(`无法写入 Hermes 配置文件：${configFile}。请检查文件权限。${err.message}`);
  }
  return apiServer.key;
}

function readApiServerKey(profileDir) {
  const configFile = path.join(profileDir, 'config.yaml');
  if (!fs.existsSync(configFile)) return '';
  try {
    const cfg = YAML.parse(fs.readFileSync(configFile, 'utf8')) || {};
    return cfg.platforms?.api_server?.key || '';
  } catch {
    return '';
  }
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanStaleGatewayLock(profileDir, logger) {
  if (process.platform !== 'win32') return;
  const lockFile = path.join(profileDir, 'gateway.lock');
  if (!fs.existsSync(lockFile)) return;
  try {
    const raw = fs.readFileSync(lockFile, 'utf8');
    const lock = JSON.parse(raw || '{}');
    const pid = Number(lock.pid);
    if (pid && isProcessAlive(pid)) return;
    fs.unlinkSync(lockFile);
  } catch (err) {
    logger?.warn?.('failed to clean stale hermes gateway lock', { lockFile, error: err.message });
  }
}

function startGateway({ hermesBin, profileDir, gatewayUrl, host, port, apiKey, logger }) {
  let child;
  try {
    child = spawn(hermesBin, ['gateway', 'run', '--replace'], {
      stdio: 'ignore',
      windowsHide: true,
      env: buildGatewayEnv({ profileDir, host, port, apiKey }),
    });
  } catch (err) {
    if (err.code === 'ENOENT') throw hermesBinError(hermesBin);
    throw err;
  }

  if (!child.pid) throw hermesBinError(hermesBin);
  const record = { child, gatewayUrl, profileDir, ready: false, earlyExit: null };
  ownedGateways.set(`${gatewayUrl}:${profileDir}`, record);
  registerCleanup();

  child.once('error', err => {
    record.earlyExit = err;
    if (err.code === 'ENOENT') {
      logger?.error?.('hermes gateway command not found', { hermesBin });
    } else {
      logger?.error?.('hermes gateway process error', { error: err.message });
    }
  });
  child.once('exit', (code, signal) => {
    if (!record.ready) record.earlyExit = new Error(`exit ${code ?? signal ?? 'unknown'}`);
    logger?.info?.('hermes gateway process exited', { code, signal });
  });

  return child;
}

function applyHermesApiKeyFromProfile(agentConfig = {}, profileDir) {
  if (agentConfig.apiKey) return agentConfig.apiKey;
  const configKey = readApiServerKey(profileDir);
  if (configKey) agentConfig.apiKey = configKey;
  return agentConfig.apiKey || '';
}

function buildGatewayEnv({ baseEnv = process.env, profileDir, host, port, apiKey }) {
  const env = {
    ...baseEnv,
    HERMES_HOME: profileDir,
    API_SERVER_ENABLED: 'true',
    API_SERVER_HOST: host,
    API_SERVER_PORT: String(port),
  };
  if (apiKey) env.API_SERVER_KEY = apiKey;
  return env;
}

async function waitForGatewayReady(gatewayUrl, agentConfig = {}, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_START_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ownedRecord = getOwnedGatewayRecord(gatewayUrl);
    if (ownedRecord?.earlyExit) {
      if (ownedRecord.earlyExit.code === 'ENOENT') throw hermesBinError(options.child?.spawnfile || 'hermes');
      throw new Error('Hermes Gateway 启动失败：hermes gateway run --replace 进程提前退出。');
    }
    if (options.child?.exitCode != null || options.child?.signalCode) {
      throw new Error('Hermes Gateway 启动失败：hermes gateway run --replace 进程提前退出。');
    }
    const health = await checkGatewayHealth(gatewayUrl, agentConfig, { timeoutMs: options.healthTimeoutMs || DEFAULT_HEALTH_TIMEOUT_MS });
    if (health.ok) {
      markOwnedGatewayReady(gatewayUrl);
      return;
    }
    if (health.authFailed) throw authError();
    await delay(pollIntervalMs);
  }
  throw new Error(`Hermes Gateway 启动超时：${normalizeGatewayUrl(gatewayUrl)}/health 未就绪。已尝试启用 api_server 并执行 hermes gateway run --replace，请检查 Hermes 配置、模型配置或端口占用。`);
}

function getOwnedGatewayRecord(gatewayUrl) {
  const normalized = normalizeGatewayUrl(gatewayUrl);
  for (const record of ownedGateways.values()) {
    if (record.gatewayUrl === normalized) return record;
  }
  return null;
}

function markOwnedGatewayReady(gatewayUrl) {
  const record = getOwnedGatewayRecord(gatewayUrl);
  if (record) record.ready = true;
}

function hermesBinError(hermesBin) {
  return new Error(`未找到 ${hermesBin} 命令。请先安装 Hermes Agent，或在 agents.hermes.hermesBin / LINCO_HERMES_BIN 中配置 Hermes 可执行文件路径。`);
}

function isLoopbackHost(host) {
  const value = String(host || '').toLowerCase();
  return value === 'localhost' || value === '127.0.0.1' || value === '::1' || value === '[::1]';
}

function authError() {
  return new Error('Hermes Gateway 返回 401。请检查 agents.hermes.apiKey / LINCO_HERMES_API_KEY 是否与 Hermes api_server.key 一致。');
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
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

module.exports = {
  DEFAULT_GATEWAY_URL,
  checkGatewayHealth,
  ensureApiServerConfig,
  ensureHermesGateway,
  normalizeGatewayUrl,
  resolveHermesGatewayOptions,
  resolveHermesProfileDir,
  _internal: {
    activeProfileBase,
    applyHermesApiKeyFromProfile,
    buildGatewayEnv,
    profileScopedGatewayUrl,
    profileScopedPort,
    readActiveHermesProfile,
    resolveHermesProfile,
    shouldUseProfileScopedGateway,
  },
};
