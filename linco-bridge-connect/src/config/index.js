const { findGitBash, resolveCommand } = require('./commandResolution');
const { loadConfig, parseToken } = require('./env');
const {
  ensureDir,
  getConfigDir,
  getConfigFile,
  readUserConfig,
  saveUserConfig,
  updateUserConfig,
} = require('./io');
const { removeConfiguredAccount } = require('./accounts');
const {
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_IM_IDLE_SESSION_MS,
  DEFAULT_UNSAFE_ATTACHMENT_EXTENSIONS,
  TIMEOUT,
} = require('./defaults');
const {
  getChannelAgentWsUrl,
  getChannelAgentWsUrls,
  getChannelPreset,
} = require('../channels/registry');
const {
  DEFAULT_LINCO_WS_URL,
  OFFICIAL_LINCO_AGENT_WS_URLS,
  OFFICIAL_LINCO_WS_BASE_URL,
  officialLincoAgentWsUrl,
} = require('../channels/presets/linco');

const DEFAULT_AGENT_WS_URLS = OFFICIAL_LINCO_AGENT_WS_URLS;

module.exports = {
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_AGENT_WS_URLS,
  DEFAULT_IM_IDLE_SESSION_MS,
  DEFAULT_LINCO_WS_URL,
  DEFAULT_UNSAFE_ATTACHMENT_EXTENSIONS,
  OFFICIAL_LINCO_AGENT_WS_URLS,
  OFFICIAL_LINCO_WS_BASE_URL,
  ensureDir,
  findGitBash,
  getConfigDir,
  getConfigFile,
  getChannelAgentWsUrl,
  getChannelAgentWsUrls,
  getChannelPreset,
  loadConfig,
  parseToken,
  readUserConfig,
  removeConfiguredAccount,
  resolveCommand,
  saveUserConfig,
  officialLincoAgentWsUrl,
  updateUserConfig,
};
