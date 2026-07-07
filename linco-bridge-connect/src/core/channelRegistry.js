const lincoAdapter = require('../channel/linco');
const lincoDemoAdapter = require('../channel/lincoDemo');

const CHANNEL_ADAPTERS = {
  [lincoAdapter.name]: lincoAdapter,
  [lincoDemoAdapter.name]: lincoDemoAdapter,
};

const CHANNEL_PRESETS = {
  linco: {
    name: 'linco',
    defaultWsUrl: lincoAdapter.defaults.DEFAULT_LINCO_WS_URL,
    agentWsUrls: lincoAdapter.defaults.OFFICIAL_LINCO_AGENT_WS_URLS,
  },
  'linco-demo': {
    name: 'linco-demo',
    defaultWsUrl: lincoDemoAdapter.defaults.DEFAULT_LINCO_DEMO_WS_URL,
    agentWsUrls: lincoDemoAdapter.defaults.OFFICIAL_LINCO_DEMO_AGENT_WS_URLS,
  },
};

function normalizeChannelName(channel) {
  return String(channel || '').trim();
}

function getChannelPreset(channel) {
  return CHANNEL_PRESETS[normalizeChannelName(channel)] || null;
}

function getChannelAdapter(channel) {
  return CHANNEL_ADAPTERS[normalizeChannelName(channel)] || null;
}

function registerChannelAdapter(adapter) {
  const name = normalizeChannelName(adapter?.name, '');
  if (!name) throw new Error('channel adapter name is required');
  CHANNEL_ADAPTERS[name] = adapter;
  if (adapter.preset) {
    CHANNEL_PRESETS[name] = {
      name,
      ...adapter.preset,
    };
  }
  return adapter;
}

function getChannelAgentWsUrls(channel) {
  const preset = getChannelPreset(channel);
  return { ...(preset?.agentWsUrls || {}) };
}

function getChannelAgentWsUrl(channel, agentType) {
  const preset = getChannelPreset(channel);
  if (!preset) return '';
  return preset.agentWsUrls?.[agentType] || preset.defaultWsUrl || '';
}

module.exports = {
  CHANNEL_ADAPTERS,
  CHANNEL_PRESETS,
  getChannelAdapter,
  getChannelAgentWsUrl,
  getChannelAgentWsUrls,
  getChannelPreset,
  registerChannelAdapter,
};
