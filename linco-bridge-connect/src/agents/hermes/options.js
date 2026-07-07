const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { saveSessionMetadata } = require('../../core/session');
const { resolveHermesProfileDir } = require('../../gateways/hermesGateway');

const NO_HERMES_MODEL_DEFAULT = '__LINCO_NO_HERMES_MODEL_DEFAULT__';

function currentHermesModel(session, agentConfig = {}) {
  return String(session?.hermesModelOverride || configuredHermesModel(agentConfig) || '').trim();
}

function configuredHermesModel(agentConfig = {}) {
  return String(agentConfig.model || readHermesProfileDefaultModel(agentConfig) || '').trim();
}

function configuredHermesModelCandidates(agentConfig = {}) {
  return [agentConfig.model, readHermesProfileDefaultModel(agentConfig)].filter(Boolean);
}

function readHermesProfileDefaultModel(agentConfig = {}) {
  const profileDir = resolveHermesProfileDir(agentConfig);
  const configFile = path.join(profileDir, 'config.yaml');
  try {
    const cfg = YAML.parse(fs.readFileSync(configFile, 'utf8')) || {};
    const model = cfg.model;
    if (typeof model === 'string') return model;
    return model?.default || model?.name || model?.id || '';
  } catch {
    return '';
  }
}

function readHermesProfileConfig(agentConfig = {}) {
  const profileDir = resolveHermesProfileDir(agentConfig);
  const configFile = path.join(profileDir, 'config.yaml');
  try {
    if (!fs.existsSync(configFile)) return {};
    const cfg = YAML.parse(fs.readFileSync(configFile, 'utf8')) || {};
    return cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : {};
  } catch (err) {
    throw new Error(`failed to read ${configFile}: ${err.message}`);
  }
}

function writeHermesProfileConfig(agentConfig = {}, cfg) {
  const profileDir = resolveHermesProfileDir(agentConfig);
  const configFile = path.join(profileDir, 'config.yaml');
  try {
    fs.mkdirSync(profileDir, { recursive: true });
    fs.writeFileSync(configFile, YAML.stringify(cfg || {}, { lineWidth: 0 }));
  } catch (err) {
    throw new Error(`failed to write ${configFile}: ${err.message}`);
  }
}

function getHermesProfileModelDefaultFromConfig(cfg = {}) {
  const model = cfg.model;
  if (typeof model === 'string') return model.trim();
  if (model && typeof model === 'object' && !Array.isArray(model)) {
    return String(model.default || model.model || model.name || model.id || '').trim();
  }
  return '';
}

function setHermesProfileModelDefaultInConfig(cfg, modelName) {
  const next = cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : {};
  if (next.model && typeof next.model === 'object' && !Array.isArray(next.model)) {
    next.model.default = modelName;
  } else {
    next.model = { default: modelName };
  }
  return next;
}

function removeHermesProfileModelDefaultFromConfig(cfg) {
  const next = cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : {};
  if (typeof next.model === 'string') {
    delete next.model;
    return next;
  }
  if (next.model && typeof next.model === 'object' && !Array.isArray(next.model)) {
    delete next.model.default;
    if (Object.keys(next.model).length === 0) delete next.model;
  }
  return next;
}

function persistHermesProfileModelDefault(session, config, modelName) {
  const agentConfig = resolveHermesAgentConfig(session, config);
  const cfg = readHermesProfileConfig(agentConfig);
  const currentDefault = getHermesProfileModelDefaultFromConfig(cfg);
  if (!session.hermesModelPreviousDefault && currentDefault !== modelName) {
    session.hermesModelPreviousDefault = currentDefault || NO_HERMES_MODEL_DEFAULT;
  }
  writeHermesProfileConfig(agentConfig, setHermesProfileModelDefaultInConfig(cfg, modelName));
}

function restoreHermesProfileModelDefault(session, config) {
  const previousDefault = String(session.hermesModelPreviousDefault || '').trim();
  if (!previousDefault) return '';
  const agentConfig = resolveHermesAgentConfig(session, config);
  const cfg = readHermesProfileConfig(agentConfig);
  if (previousDefault === NO_HERMES_MODEL_DEFAULT) {
    writeHermesProfileConfig(agentConfig, removeHermesProfileModelDefaultFromConfig(cfg));
    session.hermesModelPreviousDefault = null;
    return '';
  }
  writeHermesProfileConfig(agentConfig, setHermesProfileModelDefaultInConfig(cfg, previousDefault));
  session.hermesModelPreviousDefault = null;
  return previousDefault;
}

function normalizeModelList(result, agentConfig = {}) {
  const source = Array.isArray(result)
    ? result
    : Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result?.models)
        ? result.models
        : Array.isArray(result?.items)
          ? result.items
          : [];
  return source.map(item => modelNameFromItem(item, agentConfig)).filter(Boolean);
}

function modelNameFromItem(item, agentConfig = {}) {
  if (typeof item === 'string') return item.trim();
  const provider = String(item?.provider || item?.owned_by || '').trim();
  const id = String(item?.key || item?.id || item?.model || item?.name || item?.displayName || '').trim();
  const profile = String(agentConfig.profile || 'default').trim() || 'default';
  if (!id) return '';
  if (provider === 'hermes' && (id === profile || item?.root === profile)) return '';
  if (id.includes('/') || !provider || provider === 'hermes') return id;
  return `${provider}/${id}`;
}

function uniqueModelNames(models) {
  const seen = new Set();
  const result = [];
  for (const model of models || []) {
    const value = String(model || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function resolveHermesModelInput(input, models) {
  const raw = String(input || '').trim();
  const index = Number.parseInt(raw, 10);
  if (String(index) === raw && index >= 1 && index <= models.length) return models[index - 1];
  const exact = models.find(model => model.toLowerCase() === raw.toLowerCase());
  return exact || raw;
}

function resolveHermesAgentConfig(session, config) {
  const base = config?.agents?.hermes || {};
  let profile = String(session?.hermesProfile || '').trim();
  if (!profile) {
    profile = String(base.profile || 'default').trim() || 'default';
    if (session) {
      session.hermesProfile = profile;
      if (session.runtimeDir) saveSessionMetadata(session);
    }
  }
  return { ...base, profile };
}

module.exports = {
  configuredHermesModel,
  configuredHermesModelCandidates,
  currentHermesModel,
  normalizeModelList,
  persistHermesProfileModelDefault,
  resolveHermesAgentConfig,
  resolveHermesModelInput,
  restoreHermesProfileModelDefault,
  uniqueModelNames,
};
