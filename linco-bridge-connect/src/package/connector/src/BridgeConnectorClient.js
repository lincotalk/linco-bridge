const { EventEmitter } = require('node:events');
const { WebSocket } = require('ws');
const { safeUrlForLog } = require('../../protocol');

class BridgeConnectorClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = { ...options };
    this.ws = null;
    this.stopped = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.connectTimer = null;
    this.pendingEvents = [];
  }

  start() {
    this.stopped = false;
    this.connect();
  }

  stop(options = {}) {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.connectTimer);
    clearInterval(this.heartbeatTimer);
    this.reconnectTimer = null;
    this.connectTimer = null;
    this.heartbeatTimer = null;

    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      if (options.beforeClose && ws.readyState === WebSocket.OPEN) {
        options.beforeClose();
      }
      try {
        ws.close();
      } catch {}
    }
  }

  connect() {
    if (this.stopped) return;

    let url;
    try {
      url = this.buildUrl();
    } catch (err) {
      this.emit('invalid-url', err);
      this.scheduleReconnect();
      return;
    }

    this.emit('connecting', { url, safeUrl: safeUrlForLog(url) });
    const ws = new WebSocket(url, {
      maxPayload: this.options.maxPayloadBytes,
    });
    this.ws = ws;

    this.connectTimer = setTimeout(() => {
      if (this.ws === ws && ws.readyState === WebSocket.CONNECTING) {
        ws.terminate();
      }
    }, this.options.connectTimeoutMs).unref?.();

    ws.on('open', () => {
      if (this.ws !== ws) return;
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
      this.reconnectAttempts = 0;
      this.emit('open');
      this.flushPendingEvents();
      this.startHeartbeat();
    });

    ws.on('message', (data) => {
      if (this.ws !== ws) return;
      this.emit('message', data);
    });

    ws.on('close', () => {
      if (this.ws !== ws) return;
      this.ws = null;
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.emit('close');
      this.scheduleReconnect();
    });

    ws.on('error', (err) => {
      if (this.ws !== ws) return;
      this.emit('error', err);
    });
  }

  buildUrl() {
    const url = new URL(this.options.wsUrl);
    if (url.protocol !== 'wss:' && !this.options.allowInsecureWs) {
      throw new Error('remote bridge requires wss by default; set allowInsecureWs for local debugging');
    }
    url.searchParams.delete('appId');
    url.searchParams.delete('appSecret');
    const appId = this.options.appId;
    const appSecret = this.options.appSecret;
    url.searchParams.set('token', `${appId}:${appSecret}`);
    return url.toString();
  }

  startHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (!this.isOpen()) return;
      const payload = this.options.buildHeartbeat?.('ping');
      if (payload) this.send(payload);
    }, this.options.heartbeatMs);
    this.heartbeatTimer.unref?.();
  }

  scheduleReconnect() {
    if (this.stopped) return;
    clearTimeout(this.reconnectTimer);

    const min = this.options.reconnectMinMs;
    const max = this.options.reconnectMaxMs;
    const baseDelay = Math.min(max, min * (2 ** this.reconnectAttempts));
    const jitter = Math.floor(baseDelay * 0.2 * Math.random());
    const delay = Math.min(max, baseDelay + jitter);
    this.reconnectAttempts += 1;

    this.emit('reconnect-scheduled', { delay });
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
    this.reconnectTimer.unref?.();
  }

  send(payload) {
    if (!this.isOpen()) {
      this.queue(payload);
      return false;
    }
    this.ws.send(JSON.stringify(payload));
    return true;
  }

  queue(payload) {
    if (payload?.type === 'ping' || payload?.type === 'pong') return;
    this.pendingEvents.push(payload);
    const maxPendingEvents = this.options.maxPendingEvents;
    if (this.pendingEvents.length > maxPendingEvents) {
      this.pendingEvents.splice(0, this.pendingEvents.length - maxPendingEvents);
    }
  }

  flushPendingEvents() {
    if (!this.isOpen() || this.pendingEvents.length === 0) return;
    const pending = this.pendingEvents.splice(0);
    for (const payload of pending) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

module.exports = {
  BridgeConnectorClient,
};
