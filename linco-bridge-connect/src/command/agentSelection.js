const { execFile } = require('child_process');
const path = require('path');
const { readUserConfig, saveUserConfig } = require('../config');
const { send, sendError, sendSystem } = require('../core/protocol');
const { saveSessionMetadata } = require('../core/session');
const { OpenClawGatewayClient, ensureOpenClawGateway } = require('../gateway/openclawGateway');
const { unquoteProjectPath } = require('./args');

function agentRunner() {
  return require('../runtime/agentRunner');
}

function quoteProjectPath(targetPath) {
  const value = String(targetPath || '');
  if (!value) return '""';
  if (/[\s"]/u.test(value)) return `"${value.replace(/(["\\])/g, '\\$1')}"`;
  return value;
}

function projectAction(label, command, extra = {}) {
  return {
    label,
    text: command,
    command,
    type: 'command',
    ...extra,
  };
}

function sendSlashCommandResult(ws, command, data = {}) {
  send(ws, 'slash_command_result', {
    command,
    version: 1,
    data,
  });
}

function handleAgent(rawArg, ws, session, config) {
  try {
    if ((session.agentType || 'claude') !== 'openclaw') {
      sendSystem(ws, '/agent 仅适用于 OpenClaw 模式。Hermes 请使用 /profile；Claude/Codex 不支持 Agent 选择。');
      return null;
    }

    const args = parseAgentArgs(rawArg);
    if (args.error) {
      sendError(ws, args.error);
      return null;
    }
    if (args.mode === 'cancel') {
      sendSystem(ws, '已取消 OpenClaw Agent 选择。');
      return null;
    }
    if (args.mode === 'select') {
      selectOpenClawAgent(args.agentId, ws, session, config);
      return null;
    }
    if (args.mode === 'bind') {
      bindOpenClawAgent(args.agentId, ws, session, config);
      return null;
    }

    return listOpenClawAgents(config)
      .then(result => sendOpenClawAgentChoices(ws, session, config, result.agents, result.error))
      .catch(err => sendError(ws, `OpenClaw Agent 选择失败: ${err.message}`));
  } catch (err) {
    sendError(ws, `OpenClaw Agent 选择失败: ${err.message}`);
    return null;
  }
}

function handleProfile(rawArg, ws, session, config) {
  try {
    if ((session.agentType || 'claude') !== 'hermes') {
      sendSystem(ws, '/profile 仅适用于 Hermes 模式。OpenClaw 请使用 /agent；Claude/Codex 不支持 Profile 选择。');
      return null;
    }

    const args = parseProfileArgs(rawArg);
    if (args.error) {
      sendError(ws, args.error);
      return null;
    }
    if (args.mode === 'cancel') {
      sendSystem(ws, '已取消 Hermes Profile 选择。');
      return null;
    }
    if (args.mode === 'select') {
      selectHermesProfile(args.profile, ws, session, config);
      return null;
    }
    if (args.mode === 'bind') {
      bindHermesProfile(args.profile, ws, session, config);
      return null;
    }

    return listHermesProfiles(config)
      .then(result => sendHermesProfileChoices(ws, session, config, result.profiles, result.error))
      .catch(err => sendError(ws, `Hermes Profile 选择失败: ${err.message}`));
  } catch (err) {
    sendError(ws, `Hermes Profile 选择失败: ${err.message}`);
    return null;
  }
}

function parseAgentArgs(rawArg) {
  const trimmed = String(rawArg || '').trim();
  if (!trimmed || trimmed === '--list') return { mode: 'list' };
  if (trimmed === '--cancel') return { mode: 'cancel' };
  const bindMatch = trimmed.match(/^--bind(?:\s+(.+))?$/s);
  if (bindMatch) return parseCurrentAccountBindArg(bindMatch[1] || '', 'agentId');
  const selectMatch = trimmed.match(/^--select(?:\s+(.+))?$/s);
  if (selectMatch) return { mode: 'select', agentId: unquoteProjectPath(selectMatch[1] || '') };
  return { mode: 'select', agentId: unquoteProjectPath(trimmed) };
}

function parseProfileArgs(rawArg) {
  const trimmed = String(rawArg || '').trim();
  if (!trimmed || trimmed === '--list') return { mode: 'list' };
  if (trimmed === '--cancel') return { mode: 'cancel' };
  const bindMatch = trimmed.match(/^--bind(?:\s+(.+))?$/s);
  if (bindMatch) return parseCurrentAccountBindArg(bindMatch[1] || '', 'profile');
  const selectMatch = trimmed.match(/^--select(?:\s+(.+))?$/s);
  if (selectMatch) return { mode: 'select', profile: unquoteProjectPath(selectMatch[1] || '') };
  return { mode: 'select', profile: unquoteProjectPath(trimmed) };
}

function parseCurrentAccountBindArg(rawValue, valueKey) {
  const value = String(rawValue || '').trim();
  if (/(^|\s)--account(?:=|\s|$)/.test(value)) {
    return { mode: 'bind', [valueKey]: '', error: 'Account is inferred from the incoming IM message; do not pass --account.' };
  }
  return { mode: 'bind', [valueKey]: unquoteProjectPath(value) };
}

function currentOpenClawAgentId(session, config = {}) {
  return String(session.openclawAgentId || config.agents?.openclaw?.openclawAgentId || 'main').trim() || 'main';
}

function currentHermesProfile(session, config = {}) {
  return String(session.hermesProfile || config.agents?.hermes?.profile || 'default').trim() || 'default';
}

function currentBindingAccount(session, config = {}) {
  return String(session?.linco?.accountId || config.im?.account || 'default').trim() || 'default';
}

function sessionIdentityLocked(session) {
  if (!session) return false;
  if (session.agentSessionId || session.isTurnActive) return true;
  if (session.claudeProcess) return true;
  if (session.pendingCodexManualCompaction || session.codexCompaction) return true;
  if (session.codexPendingRequests?.size > 0) return true;
  if (session.agentProcess && session.agentProcess !== session.codexAppServer) return true;
  if (session.codexAppServer) {
    return (session.agentType || '') !== 'codex';
  }
  return false;
}

function rejectLockedIdentityChange(ws) {
  sendError(ws, '当前 IM 会话已绑定 Agent Session。如需更换项目、Agent 或 Profile，请在远端 IM 创建新的 session。');
}

function selectOpenClawAgent(agentId, ws, session, config) {
  const next = String(agentId || '').trim();
  if (!next) {
    sendError(ws, 'Please specify an OpenClaw Agent ID, for example /agent --bind main.');
    return;
  }
  if (/[\x00-\x1F\x7F]/.test(next)) {
    sendError(ws, 'OpenClaw Agent ID cannot contain control characters.');
    return;
  }

  sendError(ws, `OpenClaw Agent is fixed for this IM session: ${currentOpenClawAgentId(session, config)}. Use /agent --bind ${quoteProjectPath(next)} for future sessions, or create a new IM session.`);
}

function selectHermesProfile(profile, ws, session, config) {
  const next = String(profile || '').trim();
  const validation = validateHermesProfileName(next);
  if (!validation.ok) {
    sendError(ws, validation.message);
    return;
  }

  sendError(ws, `Hermes Profile is fixed for this IM session: ${currentHermesProfile(session, config)}. Use /profile --bind ${quoteProjectPath(next)} for future sessions, or create a new IM session.`);
}

function bindOpenClawAgent(agentId, ws, session, config) {
  const next = String(agentId || '').trim();
  if (!next) {
    sendError(ws, 'Please specify an OpenClaw Agent ID, for example /agent --bind main.');
    return;
  }
  if (/[\x00-\x1F\x7F]/.test(next)) {
    sendError(ws, 'OpenClaw Agent ID cannot contain control characters.');
    return;
  }

  const result = bindAccountSelector(config, session, 'openclaw', 'openclawAgentId', next);
  if (!result.ok) {
    sendError(ws, result.message);
    return;
  }

  const current = currentOpenClawAgentId(session, config);
  if (!session.openclawAgentId) {
    session.openclawAgentId = current;
    saveSessionMetadata(session);
  }

  sendSystem(ws, `Bound ${result.channel}/${result.agentType}/${result.account} to OpenClaw Agent for future sessions: ${next}. Current session remains: ${current}`);
}

function bindHermesProfile(profile, ws, session, config) {
  const next = String(profile || '').trim();
  const validation = validateHermesProfileName(next);
  if (!validation.ok) {
    sendError(ws, validation.message);
    return;
  }

  const result = bindAccountSelector(config, session, 'hermes', 'profile', next);
  if (!result.ok) {
    sendError(ws, result.message);
    return;
  }

  const current = currentHermesProfile(session, config);
  if (!session.hermesProfile) {
    session.hermesProfile = current;
    saveSessionMetadata(session);
  }

  sendSystem(ws, `Bound ${result.channel}/${result.agentType}/${result.account} to Hermes Profile for future sessions: ${next}. Current session remains: ${current}`);
}

function bindAccountSelector(config, session, agentType, key, value) {
  const configFile = config?.configFile;
  if (!configFile) {
    return { ok: false, message: 'Runtime config has no configFile; cannot save account binding.' };
  }

  const current = readUserConfig(configFile);
  const channelName = String(session?.linco?.channel || config.im?.channel || current.defaultChannel || 'linco').trim() || 'linco';
  const account = currentBindingAccount(session, config);
  const channel = current.channels?.[channelName];
  const agent = channel?.agents?.[agentType] || {};
  const accounts = agent.accounts || {};
  const accountConfig = accounts[account] || {};

  const nextAgent = {
    ...agent,
    defaultAccount: agent.defaultAccount || account,
    accounts: {
      ...accounts,
      [account]: {
        ...accountConfig,
        [key]: value,
      },
    },
  };
  const next = {
    ...current,
    channels: {
      ...(current.channels || {}),
      [channelName]: {
        ...(channel || {}),
        agents: {
          ...(channel?.agents || {}),
          [agentType]: nextAgent,
        },
      },
    },
  };
  saveUserConfig(next, configFile);
  return { ok: true, channel: channelName, agentType, account };
}

function validateHermesProfileName(profile) {
  if (!profile) return { ok: false, message: '❌ 请指定 Hermes Profile，例如 /profile default。' };
  if (/[\x00-\x1F\x7F]/.test(profile)) return { ok: false, message: '❌ Hermes Profile 不能包含控制字符。' };
  if (profile.includes('/') || profile.includes('\\')) return { ok: false, message: '❌ Hermes Profile 不能包含路径分隔符。' };
  if (profile === '.' || profile === '..' || profile.includes('..')) return { ok: false, message: '❌ Hermes Profile 不能包含 ..。' };
  if (path.isAbsolute(profile)) return { ok: false, message: '❌ Hermes Profile 不能是绝对路径。' };
  return { ok: true };
}

function sendOpenClawAgentChoices(ws, session, config, agents, listError) {
  const current = currentOpenClawAgentId(session, config);
  const defaultId = config.agents?.openclaw?.openclawAgentId || 'main';
  const account = currentBindingAccount(session, config);
  const choices = uniqueOpenClawAgents([
    ...(agents || []),
    { id: current },
    { id: defaultId, isDefault: true },
    { id: 'main' },
  ]);
  const actions = choices.map(agent => {
    const bindCommand = agentBindCommand(agent.id);
    return projectAction(agent.id === current ? `✓ ${agent.id}` : agent.id, bindCommand, {
      action: 'bind',
      agentId: agent.id,
      account,
      bindCommand,
    });
  });
  actions.push(projectAction('取消', '/agent --cancel', { action: 'cancel' }));

  const lines = [
    '请选择 OpenClaw Agent：',
    '',
    `当前: ${current}`,
    `默认: ${defaultId}`,
    '',
    ...choices.map((agent, index) => `${index + 1}. ${formatOpenClawAgentChoice(agent, current)}`),
  ];
  if (listError) {
    lines.push('', `⚠️ 自动读取列表失败，已显示默认/当前选项。也可以发送 /agent --bind <id> 绑定后续新会话默认 Agent。`, `原因: ${listError}`);
  }

  sendSlashCommandResult(ws, 'agent', buildAgentPickerPayload(choices, actions, { current, defaultId, account, listError }));
}

function sendHermesProfileChoices(ws, session, config, profiles, listError) {
  const current = currentHermesProfile(session, config);
  const defaultProfile = config.agents?.hermes?.profile || 'default';
  const account = currentBindingAccount(session, config);
  const choices = uniqueProfiles([...(profiles || []), current, defaultProfile, 'default']);
  const actions = choices.map(profile => {
    const bindCommand = profileBindCommand(profile);
    return projectAction(profile === current ? `✓ ${profile}` : profile, bindCommand, {
      action: 'bind',
      profile,
      account,
      bindCommand,
    });
  });
  actions.push(projectAction('取消', '/profile --cancel', { action: 'cancel' }));

  const lines = [
    '请选择 Hermes Profile：',
    '',
    `当前: ${current}`,
    `默认: ${defaultProfile}`,
    '',
    ...choices.map((profile, index) => `${index + 1}. ${profile}${profile === current ? ' (当前)' : ''}`),
  ];
  if (listError) {
    lines.push('', `⚠️ 自动读取列表失败，已显示默认/当前选项。也可以发送 /profile --bind <name> 绑定后续新会话默认 Profile。`, `原因: ${listError}`);
  }

  sendSlashCommandResult(ws, 'profile', buildProfilePickerPayload(choices, actions, { current, defaultProfile, account, listError }));
}

function formatOpenClawAgentChoice(agent, current) {
  const parts = [agent.id];
  if (agent.id === current) parts.push('(当前)');
  if (agent.isDefault) parts.push('(默认)');
  if (agent.model) parts.push(`model: ${agent.model}`);
  return parts.join(' ');
}

function uniqueOpenClawAgents(agents) {
  const seen = new Set();
  const result = [];
  for (const agent of agents || []) {
    const id = String(agent?.id || agent?.name || agent?.agentId || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({ ...agent, id });
  }
  return result;
}

function uniqueProfiles(profiles) {
  const seen = new Set();
  const result = [];
  for (const profile of profiles || []) {
    const name = String(profile?.name || profile?.profile || profile || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

async function listOpenClawAgents(config = {}) {
  try {
    const agents = await listOpenClawAgentsFromGateway(config);
    if (agents.length > 0) return { agents, error: '' };
  } catch (err) {
    // Keep the CLI paths below as compatibility fallbacks for older OpenClaw installs.
  }

  const bin = config.agents?.openclaw?.bin || config.agents?.openclaw?.openclawBin || 'openclaw';
  const attempts = [
    ['gateway', 'call', '--json', 'agents.list'],
    ['agents', 'list', '--json'],
  ];
  let lastError = '';
  for (const args of attempts) {
    try {
      const stdout = await execFileText(bin, args);
      const agents = parseOpenClawAgentListOutput(stdout);
      if (agents.length > 0) return { agents, error: '' };
      lastError = `${bin} ${args.join(' ')} returned no agents`;
    } catch (err) {
      lastError = err.message;
    }
  }
  return { agents: [], error: lastError };
}

async function listOpenClawAgentsFromGateway(config = {}) {
  const agentConfig = config.agents?.openclaw || {};
  const gatewayUrl = await ensureOpenClawGateway(agentConfig, config.logger);
  const client = new OpenClawGatewayClient({
    url: gatewayUrl,
    agentConfig,
    logger: config.logger,
    requestTimeoutMs: agentConfig.requestTimeoutMs || 30000,
  });
  try {
    await client.connect();
    if (!client.supports('agents.list')) {
      throw new Error('OpenClaw Gateway is missing method: agents.list');
    }
    return normalizeOpenClawAgentList(await client.request('agents.list', {}));
  } finally {
    client.close();
  }
}

async function listHermesProfiles(config = {}) {
  const bin = config.agents?.hermes?.hermesBin || config.agents?.hermes?.bin || 'hermes';
  let lastError = '';
  for (const args of [['profile', 'list', '--json'], ['profile', 'list']]) {
    try {
      const stdout = await execFileText(bin, args);
      const profiles = parseHermesProfileListOutput(stdout);
      if (profiles.length > 0) return { profiles, error: '' };
      lastError = `${bin} ${args.join(' ')} returned no profiles`;
    } catch (err) {
      lastError = err.message;
    }
  }
  return { profiles: [], error: lastError };
}

function execFileText(file, args) {
  return new Promise((resolve, reject) => {
    const command = resolveWindowsShimCommand(file);
    execFile(command.file, command.args.concat(args), {
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr || error.message || '').trim();
        reject(new Error(detail || `${file} ${args.join(' ')} failed`));
        return;
      }
      resolve(String(stdout || ''));
    });
  });
}

function resolveWindowsShimCommand(file) {
  const raw = String(file || '').trim();
  if (process.platform !== 'win32') return { file: raw, args: [] };
  if (/\.(cmd|bat)$/i.test(raw)) return { file: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', raw] };
  if (!/[\\/]/.test(raw) && !/\.[a-z0-9]+$/i.test(raw)) return { file: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', raw] };
  return { file: raw, args: [] };
}

function parseOpenClawAgentListOutput(output) {
  const text = String(output || '').trim();
  if (!text) return [];
  const parsed = tryParseJson(text);
  if (parsed) return normalizeOpenClawAgentList(parsed);

  const agents = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^-\s+([^\s(]+)/);
    if (!match) continue;
    agents.push({ id: match[1], isDefault: /\(default\)/i.test(trimmed) });
  }
  return uniqueOpenClawAgents(agents);
}

function normalizeOpenClawAgentList(parsed) {
  const rawAgents = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.agents) ? parsed.agents : [];
  const defaultId = parsed?.defaultId || parsed?.mainKey;
  return uniqueOpenClawAgents(rawAgents.map(agent => ({
    id: agent.id || agent.agentId || agent.name,
    workspace: agent.workspace,
    agentDir: agent.agentDir,
    model: agent.model?.primary || agent.model || agent.primaryModel,
    isDefault: agent.isDefault || (defaultId && (agent.id || agent.agentId || agent.name) === defaultId),
  })));
}

function parseHermesProfileListOutput(output) {
  const text = String(output || '').trim();
  if (!text) return [];
  const parsed = tryParseJson(text);
  if (parsed) return normalizeHermesProfileList(parsed);

  const profiles = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^[-─\s]+$/.test(trimmed) || /^Profile\s+/i.test(trimmed) || /^Gateways:?$/i.test(trimmed)) continue;
    let cleaned = trimmed.replace(/^[◆*✓>\s]+/u, '').trim();
    cleaned = cleaned.replace(/^[✓]\s*/u, '').trim();
    const token = cleaned.split(/\s+/)[0];
    if (!token || token === '—' || /^[-─]+$/.test(token)) continue;
    profiles.push(token);
  }
  return uniqueProfiles(profiles);
}

function normalizeHermesProfileList(parsed) {
  const rawProfiles = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.profiles) ? parsed.profiles : [];
  return uniqueProfiles(rawProfiles);
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildAgentPickerPayload(choices, actions, { current, defaultId, account, listError } = {}) {
  return {
    version: 1,
    current,
    defaultId,
    account: account || '',
    listError: listError || '',
    items: choices.map((agent, index) => ({
      index: index + 1,
      id: agent.id,
      model: agent.model || '',
      workspace: agent.workspace || '',
      agentDir: agent.agentDir || '',
      isCurrent: agent.id === current,
      isDefault: !!agent.isDefault || agent.id === defaultId,
      account: actions[index]?.account || account || '',
      command: actions[index]?.command || agentBindCommand(agent.id),
      bindCommand: actions[index]?.bindCommand || agentBindCommand(agent.id),
    })),
    actions,
  };
}

function buildProfilePickerPayload(choices, actions, { current, defaultProfile, account, listError } = {}) {
  return {
    version: 1,
    current,
    defaultProfile,
    account: account || '',
    listError: listError || '',
    items: choices.map((profile, index) => ({
      index: index + 1,
      name: profile,
      isCurrent: profile === current,
      isDefault: profile === defaultProfile,
      account: actions[index]?.account || account || '',
      command: actions[index]?.command || profileBindCommand(profile),
      bindCommand: actions[index]?.bindCommand || profileBindCommand(profile),
    })),
    actions,
  };
}

function agentBindCommand(agentId) {
  return `/agent --bind ${quoteProjectPath(agentId)}`;
}

function profileBindCommand(profile) {
  return `/profile --bind ${quoteProjectPath(profile)}`;
}

module.exports = {
  handleAgent,
  handleProfile,
  parseAgentArgs,
  parseProfileArgs,
  currentOpenClawAgentId,
  currentHermesProfile,
  sessionIdentityLocked,
  rejectLockedIdentityChange,
  validateHermesProfileName,
  parseOpenClawAgentListOutput,
  parseHermesProfileListOutput,
  resolveWindowsShimCommand,
  buildAgentPickerPayload,
  buildProfilePickerPayload,
  formatOpenClawAgentChoice,
  sendOpenClawAgentChoices,
  sendHermesProfileChoices,
  listOpenClawAgentsFromGateway,
};
