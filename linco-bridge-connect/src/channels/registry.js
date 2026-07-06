const lincoPreset = require('./presets/linco');
const lincoDemoPreset = require('./presets/lincoDemo');

const CHANNEL_PRESETS = {
  linco: {
    name: 'linco',
    defaultWsUrl: lincoPreset.DEFAULT_LINCO_WS_URL,
    agentWsUrls: lincoPreset.OFFICIAL_LINCO_AGENT_WS_URLS,
  },
  'linco-demo': {
    name: 'linco-demo',
    defaultWsUrl: lincoDemoPreset.DEFAULT_LINCO_DEMO_WS_URL,
    agentWsUrls: lincoDemoPreset.OFFICIAL_LINCO_DEMO_AGENT_WS_URLS,
  },
};

function normalizeChannelName(channel) {
  return String(channel || '').trim();
}

function getChannelPreset(channel) {
  return CHANNEL_PRESETS[normalizeChannelName(channel)] || null;
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
  CHANNEL_PRESETS,
  getChannelAgentWsUrl,
  getChannelAgentWsUrls,
  getChannelPreset,
};
