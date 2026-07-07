const { executeAgentQuery, resolvePendingDanger, resolvePendingPermission } = require('../runtime/agentRunner');
const { handleMessageWithAttachments } = require('../attachment/attachmentHandler');
const { send, sendError, sendSystem } = require('./protocol');
const { cleanupSession, createSession, saveSessionMetadata } = require('./session');
const { handleSlashCommand, isBridgeControlCommand } = require('../command');
const { readUserConfig } = require('../config');
const { getClientInfo, getDeviceIdentity } = require('./deviceIdentity');
const { getChannelAdapter } = require('./channelRegistry');
const lincoAdapter = require('../channel/linco');
const { buildPresenceEvent } = require('./channelPresence');
const {
  connectorKey,
  remoteSessionScope,
} = require('../package/protocol');

const {
  buildStreamId,
  lincoMetaDefaults,
  normalizeLincoFiles,
  pruneUndefined,
} = lincoAdapter;

let inboundDedupe;

function startImConnector(config) {
  const connectors = startImConnectors(config);
  return connectors[0] || null;
}

function startImConnectors(config) {
  if (!config.im?.enabled) return [];
  const specs = remoteConnectorSpecs(config);

  const connectors = specs.map((spec) => {
    const connector = new ImConnector(config, spec.agentType, spec.agentConfig, spec.im);
    connector.start();
    return connector;
  });

  return connectors;
}

function syncImConnectors(config) {
  const existing = new Map((config._imConnectors || []).map(connector => [connector.key, connector]));
  const nextConnectors = [];
  const nextSpecs = config.im?.enabled ? remoteConnectorSpecs(config) : [];

  for (const spec of nextSpecs) {
    const key = connectorKey(spec.agentType, spec.im);
    const current = existing.get(key);
    const nextSignature = connectorSignature(config, spec.agentType, spec.agentConfig, spec.im);
    if (current && current.configSignature === nextSignature) {
      nextConnectors.push(current);
      existing.delete(key);
      continue;
    }

    if (current) {
      current.stop('config_reload');
      existing.delete(key);
    }

    const connector = new ImConnector(config, spec.agentType, spec.agentConfig, spec.im);
    connector.start();
    nextConnectors.push(connector);
  }

  for (const connector of existing.values()) {
    connector.stop('config_reload');
  }

  config._imConnectors = nextConnectors;
  return nextConnectors;
}

class ImConnector {
  constructor(config, agentType = 'claude', agentConfig = {}, imConfig = {}) {
    this.config = config;
    this.agentType = agentType;
    this.agentConfig = agentConfig;
    this.imConfig = {
      channel: imConfig.channel || config.im?.channel || 'linco',
      account: imConfig.account || config.im?.account || 'default',
      agentId: imConfig.agentId || config.im?.agentId || 'main',
      appId: imConfig.appId || agentConfig.appId || config.im?.appId || '',
      appSecret: imConfig.appSecret || agentConfig.appSecret || config.im?.appSecret || '',
      wsUrl: imConfig.wsUrl || agentConfig.wsUrl || config.im?.wsUrl || '',
      allowInsecureWs: imConfig.allowInsecureWs ?? config.im?.allowInsecureWs,
    };
    this.adapter = getChannelAdapter(this.imConfig.channel) || lincoAdapter;
    this.logPrefix = imLogPrefix(this.agentType, this.imConfig);
    this.key = connectorKey(agentType, this.imConfig);
    this.configSignature = connectorSignature(config, agentType, agentConfig, this.imConfig);
    this.sessions = new Map();
    this.stopped = false;
    this.client = this.createClient();
  }

  start() {
    const appId = this.imConfig.appId;
    const appSecret = this.imConfig.appSecret;
    if (!appId || !appSecret) {
      console.log(`${this.logPrefix} 远端 IM 已启用，但缺少 Linco token，已跳过连接。`);
      return;
    }

    this.connect();
  }

  stop(reason = 'shutdown') {
    this.stopped = true;
    this.client.stop({
      beforeClose: () => this.sendPresence('offline', reason),
    });

    for (const session of this.sessions.values()) {
      clearInterval(session.remoteIdleTimer);
      this.unregisterSession(session);
      cleanupSession(session);
    }
    this.sessions.clear();
  }

  connect() {
    this.stopped = false;
    this.client.start();
  }

  buildUrl() {
    return this.client.buildUrl();
  }

  startHeartbeat() {
    return this.client.startHeartbeat();
  }

  scheduleReconnect() {
    return this.client.scheduleReconnect();
  }

  handleRawMessage(data) {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      console.log(`${this.logPrefix} 收到无法解析的消息。`);
      return;
    }

    if (!this.adapter.isRemoteMessage(msg)) return;
    this.handleMessage(msg);
  }

  handleMessage(msg) {
    if (this.adapter.isPing(msg)) {
      this.sendRemote(this.buildHeartbeatMessage('pong'));
      return;
    }

    if (this.adapter.isPong(msg)) return;

    if (this.adapter.isChatMessage(msg)) {
      this.handleInboundMessage(msg);
      return;
    }

    const sessionKey = this.adapter.getSessionKey(msg);
    if (!sessionKey) return;

    const session = this.sessions.get(sessionKey);
    if (!session) return;
    session.lastRemoteActivityAt = Date.now();

    if (this.adapter.isDangerConfirm(msg)) {
      if (!resolvePendingDanger(!!msg.approved, session.ws, session, this.config)) {
        sendError(session.ws, '没有待确认的危险操作');
      }
      return;
    }

    if (!resolvePendingPermission(!!msg.approved, session.ws, session, this.config, msg.requestId)) {
      sendError(session.ws, '没有待确认的工具权限请求');
    }
  }

  handleInboundMessage(msg) {
    if (!this.adapter.shouldRouteToAgent(msg, this.agentType)) return;

    if (isDuplicateInbound(msg, this)) {
      this.config.logger?.info?.('duplicate remote message ignored', {
        agentType: this.agentType,
        accountId: msg.accountId,
        messageId: msg.messageId,
      });
      return;
    }

    console.log(`${this.logPrefix} 收到远端消息 meta ${JSON.stringify(remoteInboundMetaForLog(msg))}`);

    const sessionKey = this.adapter.getSessionKey(msg);
    if (!sessionKey) {
      this.sendLincoMessage({ ...lincoMetaForConnector(this, msg), type: 'outbound_message', text: '消息缺少 sessionKey' });
      return;
    }

    const session = this.getOrCreateSession(sessionKey, msg);
    if (!session) return;
    session.lastRemoteActivityAt = Date.now();
    const linco = lincoMetaForConnector(this, msg);
    linco.streamId = linco.streamId || buildStreamId(msg);
    linco.fullText = '';
    session.linco = linco;
    if (this.agentType === 'openclaw' && !session.openclawAgentId) {
      session.openclawAgentId = resolveOpenClawAgentIdFromMessage(msg, session, this.agentConfig, this.config);
      if (session.runtimeDir) saveSessionMetadata(session);
    }
    if (this.agentType === 'hermes' && !session.hermesProfile) {
      session.hermesProfile = resolveHermesProfileFromMessage(msg, session, this.agentConfig, this.config);
      if (session.runtimeDir) saveSessionMetadata(session);
    }

    this.handleChatMessage(msg, session);
  }

  handleChatMessage(msg, session) {
    const input = this.adapter.inboundForAgent(msg);
    const rawText = input.text;
    const attachments = input.attachments;
    const ws = createRemoteAdapter(this, session, session.linco);
    if (!session.isTurnActive) session.ws = ws;

    if ((rawText.startsWith('/') || isBridgeControlCommand(rawText)) && attachments.length === 0) {
      if (handleSlashCommand(rawText, ws, session, this.config)) return;
    }

    handleMessageWithAttachments(input, ws, session, this.config, executeAgentQuery);
  }

  getOrCreateSession(sessionKey, msg) {
    const existing = this.sessions.get(sessionKey);
    if (existing) return existing;

    let session;
    try {
      session = createSession(this.config, {
        externalSessionId: sessionKey,
        externalSessionScope: remoteSessionScope(this.imConfig),
        agentType: this.agentType,
      });
    } catch (err) {
      this.sendLincoMessage({ ...lincoMetaForConnector(this, msg), type: 'outbound_message', text: `会话初始化失败: ${err.message}` });
      return null;
    }

    if (!this.registerSession(session)) {
      cleanupSession(session);
      this.sendLincoMessage({ ...lincoMetaForConnector(this, msg), type: 'outbound_message', text: '该 sessionKey 已有活动连接' });
      return null;
    }

    const linco = lincoMetaForConnector(this, msg);
    linco.streamId = linco.streamId || buildStreamId(msg);
    linco.fullText = '';
    session.linco = linco;
    if (this.agentType === 'openclaw' && !session.openclawAgentId) {
      session.openclawAgentId = resolveOpenClawAgentIdFromMessage(msg, session, this.agentConfig, this.config);
      if (session.runtimeDir) saveSessionMetadata(session);
    }
    if (this.agentType === 'hermes' && !session.hermesProfile) {
      session.hermesProfile = resolveHermesProfileFromMessage(msg, session, this.agentConfig, this.config);
      if (session.runtimeDir) saveSessionMetadata(session);
    }
    session.ws = createRemoteAdapter(this, session, linco);
    session.lastRemoteActivityAt = Date.now();
    this.sessions.set(session.id, session);
    this.startIdleTimer(session);

    console.log(`${this.logPrefix} 新远端会话 [${session.id}]，工作目录 ${session.workspace}`);
    sendSessionInfo(session.ws, session, this.config);
    sendSystem(session.ws, `已连接到 ${this.agentType} Agent
工作目录: ${session.workspace}
输入 /help 查看可用命令`);
    return session;
  }

  registerSession(session) {
    const activeSessions = this.config.activeSessions || new Map();
    this.config.activeSessions = activeSessions;
    if (activeSessions.has(session.activeKey)) return false;
    activeSessions.set(session.activeKey, session);
    return true;
  }

  unregisterSession(session) {
    if (this.config.activeSessions?.get(session.activeKey) === session) {
      this.config.activeSessions.delete(session.activeKey);
    }
  }

  startIdleTimer(session) {
    clearInterval(session.remoteIdleTimer);
    session.remoteIdleTimer = setInterval(() => {
      const idleMs = Date.now() - (session.lastRemoteActivityAt || Date.now());
      if (idleMs >= this.config.im.idleSessionMs) {
        this.closeSession(session.id);
      }
    }, Math.min(this.config.im.idleSessionMs, 60 * 1000));
    session.remoteIdleTimer.unref?.();
  }

  closeSession(sessionKey) {
    const session = this.sessions.get(sessionKey);
    if (!session) return;

    clearInterval(session.remoteIdleTimer);
    this.sessions.delete(sessionKey);
    this.unregisterSession(session);
    cleanupSession(session);
    console.log(`${this.logPrefix} 远端会话结束 [${session.id}]`);
  }

  sendLincoMessage(payload) {
    const meta = lincoMetaDefaults(this.config, connectorLincoMeta(this, payload));
    const message = pruneUndefined({
      ...payload,
      from: payload.from || this.agentType,
      to: payload.to || 'robot',
      source: payload.source || 'ws',
      ts: payload.ts || Date.now(),
      accountId: payload.accountId || meta.accountId,
      agentId: payload.agentId || meta.agentId,
      channel: payload.channel || meta.channel,
    });
    if (message.type === 'turn_end') {
      console.log(`${this.logPrefix} 发送 turn_end meta ${JSON.stringify(remoteTurnEndMetaForLog(message))}`);
    }
    return this.sendRemote(message);
  }

  sendPresence(status, reason) {
    return this.sendRemote(buildPresenceEvent(this.config, {
      agentType: this.agentType,
      status,
      reason,
      meta: connectorLincoMeta(this, {}),
    }));
  }

  sendRemote(payload) {
    return this.client.send(payload);
  }

  buildHeartbeatMessage(type) {
    return this.adapter.buildHeartbeat(this.config, {
      type,
      agentType: this.agentType,
      meta: connectorLincoMeta(this, {}),
      device: getDeviceIdentity(this.config),
      client: getClientInfo(),
    });
  }

  queueRemote(payload) {
    this.client.queue(payload);
  }

  flushPendingEvents() {
    this.client.flushPendingEvents();
  }

  isOpen() {
    return this.client.isOpen();
  }

  createClient() {
    const Client = this.adapter.Client;
    const client = new Client({
      wsUrl: this.imConfig.wsUrl,
      appId: this.imConfig.appId,
      appSecret: this.imConfig.appSecret,
      allowInsecureWs: this.imConfig.allowInsecureWs,
      maxPayloadBytes: this.config.maxWsPayloadBytes,
      connectTimeoutMs: this.config.im.connectTimeoutMs,
      heartbeatMs: this.config.im.heartbeatMs,
      reconnectMinMs: this.config.im.reconnectMinMs,
      reconnectMaxMs: this.config.im.reconnectMaxMs,
      maxPendingEvents: this.config.im.maxPendingEvents,
      buildHeartbeat: (type) => this.buildHeartbeatMessage(type),
    });

    client.on('connecting', ({ safeUrl }) => {
      console.log(`${this.logPrefix} 正在连接远端 IM: ${safeUrl}`);
    });
    client.on('invalid-url', (err) => {
      console.log(`${this.logPrefix} 远端 IM 地址无效: ${err.message}`);
    });
    client.on('open', () => {
      console.log(`${this.logPrefix} 远端 IM 已连接。`);
      this.sendPresence('online');
    });
    client.on('message', (data) => this.handleRawMessage(data));
    client.on('close', () => {
      console.log(`${this.logPrefix} 远端 IM 连接已断开。`);
    });
    client.on('error', (err) => {
      console.log(`${this.logPrefix} 远端 IM 连接错误: ${err.message}`);
    });
    client.on('reconnect-scheduled', ({ delay }) => {
      console.log(`${this.logPrefix} ${delay}ms 后重连远端 IM。`);
    });

    return client;
  }
}

function createRemoteAdapter(connector, session, lincoMeta = session.linco || {}) {
  const adapter = connector.adapter || lincoAdapter;
  const linco = {
    ...lincoMeta,
    streamId: lincoMeta.streamId || `linco-stream-${Date.now()}`,
    fullText: lincoMeta.fullText || '',
  };

  return {
    send(jsonString) {
      let event;
      try {
        event = JSON.parse(jsonString);
      } catch {
        event = { type: 'system', text: String(jsonString || '') };
      }

      const payload = adapter.mapLocalEventToLinco(event, session, connector.config, linco);
      if (!payload) return;
      if (Array.isArray(payload)) {
        for (const item of payload) connector.sendLincoMessage(item);
        return;
      }
      connector.sendLincoMessage(payload);
    },
    linco,
  };
}

function sendSessionInfo(ws, session, config) {
  send(ws, 'session_info', {
    sessionKey: session.id,
    storageId: session.storageId,
    agentType: session.agentType,
    agentSessionId: session.agentSessionId,
    workspace: session.workspace,
    runtime: {
      dir: session.runtimeDir,
      attachmentsDir: session.attachmentsDir,
    },
    upload: {
      maxCount: config.maxAttachmentCount,
      maxFileBytes: config.maxAttachmentBytes,
      maxTotalBytes: config.maxTotalAttachmentBytes,
      blockedExtensions: config.allowUnsafeAttachments ? [] : config.unsafeAttachmentExtensions,
    },
    capabilities: {
      incomingAttachments: true,
      multimodalImages: ['claude', 'hermes', 'openclaw'].includes(session.agentType),
      remoteIm: true,
      agentType: session.agentType,
    },
  });
}

class DedupeStore {
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  has(key) {
    this.prune();
    return this.map.has(key);
  }

  add(key) {
    this.prune();
    this.map.set(key, Date.now());
  }

  prune() {
    const cutoff = Date.now() - this.ttlMs;
    for (const [key, ts] of this.map) {
      if (ts < cutoff) this.map.delete(key);
    }
  }
}

function isDuplicateInbound(msg, connector) {
  if (!inboundDedupe) inboundDedupe = new DedupeStore(48 * 60 * 60 * 1000);
  const messageId = String(msg.messageId || '').trim();
  if (!messageId) return false;
  const accountId = String(msg.accountId || connector?.imConfig?.account || 'default').trim() || 'default';
  const channel = String(msg.channel || connector?.imConfig?.channel || 'linco').trim() || 'linco';
  const agentType = String(connector?.agentType || msg.to || 'agent').trim() || 'agent';
  const key = `${agentType}:${channel}:${accountId}:${messageId}`;
  if (inboundDedupe.has(key)) return true;
  inboundDedupe.add(key);
  return false;
}

function resolveOpenClawAgentIdFromMessage(msg, session, agentConfig, config) {
  if (session.openclawAgentId) return String(session.openclawAgentId).trim() || 'main';
  return String(
    msg.openclawAgentId ||
    accountSelectorFromMessage(msg, session, config, 'openclaw', 'openclawAgentId') ||
    agentConfig.openclawAgentId ||
    config.agents?.openclaw?.openclawAgentId ||
    'main'
  ).trim() || 'main';
}

function resolveHermesProfileFromMessage(msg, session, agentConfig, config) {
  if (session.hermesProfile) return String(session.hermesProfile).trim() || 'default';
  return String(
    msg.hermesProfile ||
    msg.profile ||
    accountSelectorFromMessage(msg, session, config, 'hermes', 'profile') ||
    agentConfig.profile ||
    config.agents?.hermes?.profile ||
    'default'
  ).trim() || 'default';
}

function accountSelectorFromMessage(msg, session, config, agentType, key) {
  const account = String(msg?.accountId || session?.linco?.accountId || config?.im?.account || 'default').trim() || 'default';
  const channel = String(msg?.channel || session?.linco?.channel || config?.im?.channel || 'linco').trim() || 'linco';
  const channelConfig = readChannelAgentConfig(config, channel, agentType);
  return channelConfig?.accounts?.[account]?.[key] || '';
}

function readChannelAgentConfig(config, channel, agentType) {
  const fromRuntime = config?.channels?.[channel]?.agents?.[agentType];
  if (fromRuntime) return fromRuntime;
  if (!config?.configFile) return null;
  try {
    return readUserConfig(config.configFile).channels?.[channel]?.agents?.[agentType] || null;
  } catch {
    return null;
  }
}

function lincoSessionKey(msg) {
  return String(msg.sessionKey || '').trim();
}

function lincoMetaFromMessage(msg) {
  const userId = stringOrUndefined(msg.userId || msg.targetId);
  return pruneUndefined({
    accountId: stringOrUndefined(msg.accountId),
    agentId: stringOrUndefined(msg.agentId),
    chatType: stringOrUndefined(msg.chatType || msg.targetType),
    targetType: stringOrUndefined(msg.targetType || msg.chatType),
    targetId: stringOrUndefined(msg.targetId || msg.userId),
    userId,
    messageId: stringOrUndefined(msg.messageId),
    streamId: stringOrUndefined(msg.streamId) || buildStreamId(msg),
    sessionKey: lincoSessionKey(msg),
    channel: stringOrUndefined(msg.channel),
  });
}

function remoteInboundMetaForLog(msg) {
  const files = normalizeLincoFiles(msg);
  return pruneUndefined({
    type: stringOrUndefined(msg.type),
    messageId: stringOrUndefined(msg.messageId),
    streamId: stringOrUndefined(msg.streamId) || buildStreamId(msg),
    sessionKey: lincoSessionKey(msg) || undefined,
    accountId: stringOrUndefined(msg.accountId),
    agentId: stringOrUndefined(msg.agentId),
    to: stringOrUndefined(msg.to),
    from: stringOrUndefined(msg.from),
    channel: stringOrUndefined(msg.channel),
    chatType: stringOrUndefined(msg.chatType || msg.targetType),
    userId: stringOrUndefined(msg.userId || msg.targetId),
    textLength: String(msg.text || '').length,
    attachmentCount: files.length,
  });
}

function remoteTurnEndMetaForLog(message) {
  return pruneUndefined({
    type: stringOrUndefined(message.type),
    requestId: stringOrUndefined(message.requestId || message.request_id),
    messageId: stringOrUndefined(message.messageId),
    streamId: stringOrUndefined(message.streamId || message.stream_id),
    sessionKey: stringOrUndefined(message.sessionKey || message.session_key),
    accountId: stringOrUndefined(message.accountId),
    agentId: stringOrUndefined(message.agentId),
    channel: stringOrUndefined(message.channel),
    reason: stringOrUndefined(message.reason),
  });
}

function stringOrUndefined(value) {
  const text = String(value || '').trim();
  return text || undefined;
}

function buildHeartbeatMessage(config, options = {}) {
  return lincoAdapter.buildHeartbeat(config, {
    ...options,
    device: getDeviceIdentity(config),
    client: getClientInfo(),
  });
}

function remoteConnectorSpecs(config) {
  const configured = Array.isArray(config.im?.connectors) ? config.im.connectors : [];
  if (configured.length > 0) {
    return configured
      .filter(item => item && config.agents?.[item.agentType]?.enabled && hasWsUrl(item.wsUrl))
      .map(item => ({
        agentType: item.agentType,
        agentConfig: config.agents[item.agentType],
        im: item,
      }));
  }

  return Object.entries(config.agents || { claude: { enabled: true } })
    .filter(([, agent]) => agent?.enabled)
    .map(([agentType, agent]) => {
      const im = {
        channel: config.im?.channel,
        account: config.im?.account,
        agentId: config.im?.agentId,
        appId: agent.appId || config.im?.appId,
        appSecret: agent.appSecret || config.im?.appSecret,
        wsUrl: agent.wsUrl || config.im?.wsUrl,
        allowInsecureWs: config.im?.allowInsecureWs,
      };
      return {
        agentType,
        agentConfig: agent,
        im,
      };
    })
    .filter(spec => hasWsUrl(spec.im.wsUrl));
}

function hasWsUrl(value) {
  return String(value || '').trim() !== '';
}

function imLogPrefix(agentType, imConfig = {}) {
  const channel = String(imConfig.channel || 'linco').trim() || 'linco';
  const normalizedAgentType = String(agentType || 'agent').trim() || 'agent';
  const account = String(imConfig.account || 'default').trim() || 'default';
  return `[IM:${channel}/${normalizedAgentType}/${account}]`;
}

function connectorLincoMeta(connector, meta = {}) {
  return {
    ...meta,
    accountId: meta.accountId || connector.imConfig.account,
    agentId: meta.agentId || connector.imConfig.agentId,
    channel: meta.channel || connector.imConfig.channel,
  };
}

function connectorSignature(config, agentType, agentConfig = {}, imConfig = {}) {
  return JSON.stringify({
    key: connectorKey(agentType, imConfig),
    agentType,
    imEnabled: config.im?.enabled === true,
    wsUrl: imConfig.wsUrl || agentConfig.wsUrl || config.im?.wsUrl || '',
    appId: imConfig.appId || agentConfig.appId || config.im?.appId || '',
    appSecret: imConfig.appSecret || agentConfig.appSecret || config.im?.appSecret || '',
    allowInsecureWs: (imConfig.allowInsecureWs ?? config.im?.allowInsecureWs) === true,
    connectTimeoutMs: config.im?.connectTimeoutMs,
    heartbeatMs: config.im?.heartbeatMs,
    reconnectMinMs: config.im?.reconnectMinMs,
    reconnectMaxMs: config.im?.reconnectMaxMs,
    maxPayloadBytes: config.maxWsPayloadBytes,
    account: imConfig.account || config.im?.account || '',
    channel: imConfig.channel || config.im?.channel || '',
    agentId: imConfig.agentId || config.im?.agentId || '',
  });
}

function lincoMetaForConnector(connector, msg) {
  return connectorLincoMeta(connector, lincoMetaFromMessage(msg));
}

module.exports = {
  ImConnector,
  startImConnector,
  startImConnectors,
  syncImConnectors,
  _internal: {
    buildHeartbeatMessage,
    connectorKey,
    connectorSignature,
    imLogPrefix,
    remoteConnectorSpecs,
    remoteSessionScope,
    createRemoteAdapter,
    lincoMetaFromMessage,
    remoteInboundMetaForLog,
    remoteTurnEndMetaForLog,
    accountSelectorFromMessage,
    resolveHermesProfileFromMessage,
    resolveOpenClawAgentIdFromMessage,
  },
};
