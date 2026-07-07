const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../config');
const { syncImConnectors } = require('../channels/bridge/connector');

const RUNTIME_KEYS = new Set([
  'activeSessions',
  'logger',
  '_configWatcher',
  '_configReloadTimer',
  '_configReloading',
  '_controlServer',
  '_controlSocketPath',
  '_imConnectors',
  '_localWss',
  '_shutdownPromise',
]);

function startConfigReloadWatcher(rootDir, config, options = {}) {
  if (config._configWatcher || options.enabled === false) return null;

  const configFile = config.configFile;
  if (!configFile) return null;

  try {
    const configDir = path.dirname(configFile);
    const configName = path.basename(configFile);
    const watcher = fs.watch(configDir, { persistent: false }, (_eventType, filename) => {
      if (filename && path.basename(String(filename)) !== configName) return;
      scheduleConfigReload(rootDir, config, options);
    });
    watcher.on('error', (err) => {
      config.logger?.warn('config watcher failed', { configFile, error: err.message });
    });
    config._configWatcher = watcher;
    config.logger?.info('config reload watcher started', { configFile, configDir });
    return watcher;
  } catch (err) {
    config.logger?.warn('config watcher unavailable', { configFile, error: err.message });
    return null;
  }
}

function stopConfigReloadWatcher(config) {
  clearTimeout(config._configReloadTimer);
  config._configReloadTimer = null;
  if (!config._configWatcher) return;
  try {
    config._configWatcher.close();
  } catch {}
  config._configWatcher = null;
}

function scheduleConfigReload(rootDir, config, options = {}) {
  clearTimeout(config._configReloadTimer);
  const debounceMs = options.debounceMs ?? 800;
  config._configReloadTimer = setTimeout(() => {
    config._configReloadTimer = null;
    reloadRuntimeConfig(rootDir, config, options);
  }, debounceMs);
  config._configReloadTimer.unref?.();
}

function reloadRuntimeConfig(rootDir, config, options = {}) {
  if (config._configReloading) return false;
  config._configReloading = true;
  try {
    const nextConfig = loadConfig(rootDir);
    applyRuntimeConfig(config, nextConfig);
    syncImConnectors(config);
    config.logger?.info('config reloaded', {
      configFile: config.configFile,
      agents: Object.entries(config.agents || {}).filter(([, agent]) => agent.enabled).map(([type]) => type),
      imEnabled: config.im?.enabled === true,
    });
    options.onReload?.(config);
    return true;
  } catch (err) {
    config.logger?.warn('config reload failed; keeping current config', {
      configFile: config.configFile,
      error: err.message,
    });
    options.onError?.(err);
    return false;
  } finally {
    config._configReloading = false;
  }
}

function applyRuntimeConfig(target, nextConfig) {
  const runtime = {};
  for (const key of RUNTIME_KEYS) {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      runtime[key] = target[key];
    }
  }

  for (const key of Object.keys(target)) {
    if (!RUNTIME_KEYS.has(key)) delete target[key];
  }

  Object.assign(target, nextConfig, runtime);
  return target;
}

module.exports = {
  applyRuntimeConfig,
  reloadRuntimeConfig,
  scheduleConfigReload,
  startConfigReloadWatcher,
  stopConfigReloadWatcher,
};
