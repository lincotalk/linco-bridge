const http = require('http');
const fs = require('fs');
const path = require('path');
const { isLocalRequestAuthorized } = require('./localAuth');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

function createStaticServer(config) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (!isLocalRequestAuthorized(req, config, url)) {
      return rejectUnauthorized(res);
    }

    if (url.pathname === '/api/client-config') {
      return handleClientConfigRequest(req, res, config);
    }

    const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
    let relativePath;

    try {
      relativePath = decodeURIComponent(requestPath).replace(/^\/+/, '');
    } catch {
      res.writeHead(400);
      return res.end('Bad request');
    }

    const fullPath = path.resolve(config.publicDir, relativePath);

    if (!fullPath.startsWith(path.resolve(config.publicDir) + path.sep)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    const ext = path.extname(fullPath);

    fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(data);
    });
  });
}

function rejectUnauthorized(res) {
  res.writeHead(401, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end('未授权访问本地测试页，请使用 linco-connect start 输出的本地测试地址打开。');
}

function handleClientConfigRequest(req, res, config) {
  let wsUrl;
  try {
    wsUrl = buildClientWebSocketUrl(req, config);
  } catch {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'Invalid WebSocket configuration' }));
  }

  const body = JSON.stringify({
    wsUrl,
    account: config.im?.account || '',
    configured: Boolean(config.im?.appId && config.im?.appSecret),
    defaultLocalAgent: config.defaultLocalAgent || 'claude',
    localImEnabled: config.localWeb?.imEnabled === true,
    agents: localAgentOptions(config),
  });

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function buildClientWebSocketUrl(req, config) {
  const wsUrl = new URL(defaultWebSocketUrl(req));

  if (config.localWeb?.token) wsUrl.searchParams.set('localToken', config.localWeb.token);

  return wsUrl.toString();
}

function localAgentOptions(config) {
  const agents = config.agents || {};
  return ['claude', 'codex', 'hermes', 'openclaw']
    .filter(type => agents[type])
    .map(type => ({
      type,
      label: type === 'claude' ? 'Claude Code' : type === 'codex' ? 'Codex' : type === 'hermes' ? 'Hermes' : type === 'openclaw' ? 'OpenClaw' : type,
      enabled: agents[type]?.enabled === true,
    }));
}

function defaultWebSocketUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const requestProto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const firstProto = String(requestProto || '').split(',')[0].trim();
  const protocol = firstProto === 'https' ? 'wss:' : 'ws:';
  const host = req.headers.host || 'localhost';
  return `${protocol}//${host}`;
}


module.exports = {
  createStaticServer,
};
