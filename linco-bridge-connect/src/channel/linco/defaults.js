const OFFICIAL_LINCO_WS_BASE_URL = 'wss://app.lincotalk.com/socket/ai';

const OFFICIAL_LINCO_AGENT_WS_URLS = {
  claude: `${OFFICIAL_LINCO_WS_BASE_URL}/claude`,
  codex: `${OFFICIAL_LINCO_WS_BASE_URL}/codex`,
  hermes: `${OFFICIAL_LINCO_WS_BASE_URL}/hermes`,
  openclaw: `${OFFICIAL_LINCO_WS_BASE_URL}/openclaw`,
};

const DEFAULT_LINCO_WS_URL = OFFICIAL_LINCO_AGENT_WS_URLS.claude;

function officialLincoAgentWsUrl(agentType) {
  return OFFICIAL_LINCO_AGENT_WS_URLS[agentType] || DEFAULT_LINCO_WS_URL;
}

module.exports = {
  DEFAULT_LINCO_WS_URL,
  OFFICIAL_LINCO_AGENT_WS_URLS,
  OFFICIAL_LINCO_WS_BASE_URL,
  officialLincoAgentWsUrl,
};
