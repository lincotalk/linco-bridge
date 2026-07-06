const net = require('net');
const fs = require('fs');
const path = require('path');
const { reloadRuntimeConfig } = require('./configRuntime');

function startControlServer(rootDir, config, options = {}) {
  if (config._controlServer || options.enabled === false) return null;

  const socketPath = controlSocketPath(config);
  cleanupStaleControlSocket(socketPath);
  const server = net.createServer((socket) => {
    let data = '';
    let handled = false;
    socket.setEncoding('utf8');
    socket.on('data', chunk => {
      data += chunk;
      if (data.length > 1024) socket.destroy();
      if (!handled && data.includes('\n')) {
        handled = true;
        handleControlRequest(rootDir, config, data.slice(0, data.indexOf('\n')), socket);
      }
    });
    socket.on('end', () => {
      if (handled) return;
      handled = true;
      handleControlRequest(rootDir, config, data, socket);
    });
    socket.on('error', () => {});
  });

  server.on('error', (err) => {
    config.logger?.warn('control server failed', { socketPath, error: err.message });
  });

  try {
    server.listen(socketPath, () => {
      config.logger?.info('control server started', { socketPath });
    });
    server.unref?.();
    config._controlServer = server;
    config._controlSocketPath = socketPath;
    return server;
  } catch (err) {
    config.logger?.warn('control server unavailable', { socketPath, error: err.message });
    return null;
  }
}

function stopControlServer(config) {
  const server = config._controlServer;
  config._controlServer = null;
  if (!server) return;
  try {
    server.close();
  } catch {}
}

function sendControlCommand(config, command, options = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(controlSocketPath(config));
    let data = '';
    let settled = false;
    const timeout = setTimeout(() => {
      finish(new Error('control command timed out'));
      try {
        socket.destroy();
      } catch {}
    }, options.timeoutMs || 5000);

    function finish(err, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (err) reject(err);
      else resolve(value);
    }

    socket.setEncoding('utf8');
    socket.on('connect', () => {
      socket.end(`${JSON.stringify({ command })}\n`);
    });
    socket.on('data', chunk => {
      data += chunk;
    });
    socket.on('end', () => {
      try {
        finish(null, JSON.parse(data || '{}'));
      } catch (err) {
        finish(err);
      }
    });
    socket.on('error', finish);
  });
}

function handleControlRequest(rootDir, config, data, socket) {
  let request;
  try {
    request = JSON.parse(data || '{}');
  } catch {
    return writeControlResponse(socket, { ok: false, error: 'invalid request json' });
  }

  if (request.command !== 'reload') {
    return writeControlResponse(socket, { ok: false, error: `unknown command: ${request.command || ''}` });
  }

  const ok = reloadRuntimeConfig(rootDir, config);
  return writeControlResponse(socket, {
    ok,
    configFile: config.configFile,
    imEnabled: config.im?.enabled === true,
    agents: Object.entries(config.agents || {}).filter(([, agent]) => agent.enabled).map(([type]) => type),
  });
}

function writeControlResponse(socket, payload) {
  try {
    socket.end(JSON.stringify(payload));
  } catch {}
}

function controlSocketPath(config) {
  if (process.platform === 'win32') {
    const key = Buffer.from(path.resolve(config.lincoHome || '.')).toString('hex').slice(0, 80);
    return `\\\\.\\pipe\\linco-connect-${key}`;
  }
  return path.join(config.lincoHome, 'linco-connect-control.sock');
}

function cleanupStaleControlSocket(socketPath) {
  if (process.platform === 'win32') return;
  try {
    if (fsLikeExists(socketPath)) fs.rmSync(socketPath, { force: true });
  } catch {}
}

function fsLikeExists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  controlSocketPath,
  sendControlCommand,
  startControlServer,
  stopControlServer,
};
