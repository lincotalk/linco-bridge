const { ensureDir, loadConfig } = require('../config');
const { ensureLocalToken, localUrlWithToken } = require('../local/auth');
const { createStaticServer } = require('../local/static');
const { startControlServer, stopControlServer } = require('./control');
const { startImConnectors } = require('../channels/bridge/connector');
const { startConfigReloadWatcher, stopConfigReloadWatcher } = require('./reload');
const { createLogger } = require('../core/logger');
const { attachWebSocketServer } = require('../local/websocket');
const { cleanupSession } = require('../core/session');

async function prewarmHermesGateway(config) {
  const hermes = config.agents?.hermes;
  if (!hermes?.enabled || hermes.autoStartGateway === false) return;
  try {
    const { ensureHermesGateway } = require('../gateways/hermesGateway');
    await ensureHermesGateway(hermes, config.logger);
    config.logger?.info('hermes gateway pre-warmed', { gatewayUrl: hermes.gatewayUrl || 'http://127.0.0.1:8642' });
  } catch (err) {
    config.logger?.warn('hermes gateway pre-warm failed', { error: err.message });
  }
}

function startServer(rootDir, options = {}) {
  const config = options.config || loadConfig(rootDir);
  config.logger = options.logger || config.logger || createLogger(config);
  const log = config.logger;
  ensureLocalToken(config);

  if (config.gitBashEnv) {
    log.info('git bash detected', { path: config.gitBashEnv });
  }

  const imConnectors = startImConnectors(config);
  config._imConnectors = imConnectors;
  startConfigReloadWatcher(rootDir, config, options.configReload);
  startControlServer(rootDir, config, options.controlServer);

  if (config.localWeb?.enabled) {
    const server = createStaticServer(config);
    config._localWss = attachWebSocketServer(server, config);

    server.on('close', () => {
      log.info('server closing');
      stopConfigReloadWatcher(config);
      stopControlServer(config);
      for (const connector of config._imConnectors || []) connector.stop();
      config._imConnectors = [];
      config._localWss = null;
      options.onClose?.(server, config);
    });

    server.listen(config.port, config.host, () => {
      ensureDir(config.lincoHome);
      ensureDir(config.sessionsDir);
      ensureDir(config.logsDir);
      const localUrl = localUrlWithToken(config);
      log.info('server started', {
        host: config.host,
        port: config.port,
        lincoHome: config.lincoHome,
        sessionsDir: config.sessionsDir,
        imEnabled: !!config.im?.enabled,
        agents: Object.entries(config.agents || {}).filter(([, agent]) => agent.enabled).map(([type]) => type),
      });
      console.log('🚀 IM + Agent 桥接服务已启动');
      console.log('');
      console.log('📋 请复制下面的完整地址到浏览器打开本地测试页：');
      console.log(localUrl);
      console.log('');
      console.log(`   Linco 运行目录: ${config.lincoHome}`);
      console.log(`   会话目录: ${config.sessionsDir}`);
      console.log(`   日志级别: ${config.logLevel}`);
      if (config.im?.enabled) {
        const enabledAgents = Object.entries(config.agents || {}).filter(([, agent]) => agent.enabled).map(([type]) => type).join(', ');
        console.log(`   远端 IM: 已启用 (${config.im.channel}/${config.im.account}; agents: ${enabledAgents || 'none'})`);
      }
      prewarmHermesGateway(config);
      options.onListening?.(server, config);
    });

    return server;
  } else {
    ensureDir(config.lincoHome);
    ensureDir(config.sessionsDir);
    ensureDir(config.logsDir);
    log.info('server started (no local web)', {
      lincoHome: config.lincoHome,
      sessionsDir: config.sessionsDir,
      imEnabled: !!config.im?.enabled,
      agents: Object.entries(config.agents || {}).filter(([, agent]) => agent.enabled).map(([type]) => type),
    });
    console.log('🚀 IM + Agent 桥接服务已启动（本地测试页未启用）');
    console.log('');
    console.log(`   Linco 运行目录: ${config.lincoHome}`);
    console.log(`   会话目录: ${config.sessionsDir}`);
    console.log(`   日志级别: ${config.logLevel}`);
    if (config.im?.enabled) {
      const enabledAgents = Object.entries(config.agents || {}).filter(([, agent]) => agent.enabled).map(([type]) => type).join(', ');
      console.log(`   远端 IM: 已启用 (${config.im.channel}/${config.im.account}; agents: ${enabledAgents || 'none'})`);
    }
    console.log('');
    console.log('💡 如需开启本地测试页，请运行 linco-connect start --local-im');
    prewarmHermesGateway(config);
    options.onListening?.(null, config);
    return null;
  }
}

async function stopServer(config, server, options = {}) {
  if (!config?.lincoHome) return;
  if (config._shutdownPromise) return config._shutdownPromise;

  config._shutdownPromise = (async () => {
    const log = config.logger;
    log?.info('server shutdown started');

    for (const connector of config._imConnectors || []) {
      try {
        connector.stop();
      } catch (err) {
        log?.warn('im connector stop failed', { error: err.message });
      }
    }
    config._imConnectors = [];
    stopConfigReloadWatcher(config);
    stopControlServer(config);

    closeLocalWebSockets(config);
    cleanupActiveSessions(config);
    await closeHttpServer(server, options.serverCloseMs || 1000);

    // Session cleanup first closes stdin; wait long enough for the fallback
    // process-tree kill to run before the parent exits.
    await delay(options.childGraceMs || 3200);
    log?.info('server shutdown completed');
  })();

  return config._shutdownPromise;
}

function closeLocalWebSockets(config) {
  const wss = config._localWss;
  if (!wss) return;

  for (const client of wss.clients || []) {
    try {
      client.close(1001, 'Server shutdown');
    } catch {}
  }

  setTimeout(() => {
    for (const client of wss.clients || []) {
      try {
        client.terminate();
      } catch {}
    }
  }, 1000).unref?.();

  try {
    wss.close();
  } catch {}
}

function cleanupActiveSessions(config) {
  const activeSessions = config.activeSessions;
  if (!activeSessions?.size) return;

  const sessions = [...activeSessions.values()];
  activeSessions.clear();
  for (const session of sessions) {
    try {
      cleanupSession(session);
    } catch (err) {
      config.logger?.warn('session cleanup failed', {
        sessionId: session?.id,
        agentType: session?.agentType,
        error: err.message,
      });
    }
  }
}

function closeHttpServer(server, timeoutMs) {
  if (!server || typeof server.close !== 'function') return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    timer.unref?.();

    try {
      server.close(() => {
        clearTimeout(timer);
        finish();
      });
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  startServer,
  stopServer,
};
