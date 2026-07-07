const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { startServer, stopServer } = require('../service/server');
const { ensureDir, loadConfig } = require('../config');
const { ensureLocalToken } = require('../local/auth');
const { sendControlCommand } = require('../service/control');
const pkg = require('../../package.json');

async function startCommand(options = {}, context = {}) {
  const rootDir = context.rootDir;
  if (options['local-im'] || options['mock-im']) {
    process.env.LINCO_LOCAL_IM_ENABLED = '1';
  }

  const config = loadConfig(rootDir);
  ensureLocalToken(config);

  if (options.daemon && options['daemon-child']) {
    throw new Error('--daemon 与 --daemon-child 不能同时使用');
  }

  if (options.daemon) {
    await startDaemon(config, context);
    return;
  }

  if (options['daemon-child']) {
    startDaemonChild(config, context);
    return;
  }

  await startForeground(config, context);
}

async function startDaemon(config, context = {}) {
  const rootDir = context.rootDir;
  const cliFile = context.cliFile;
  ensureDir(config.lincoHome);
  ensureDir(config.logsDir);

  await restartExistingProcessIfRunning(config, context);

  const logs = daemonLogFiles(config);
  const outFd = fs.openSync(logs.stdoutLog, 'a');
  const errFd = fs.openSync(logs.stderrLog, 'a');
  const childArgs = [cliFile, 'start', '--daemon-child'];
  if (config.localWeb?.imEnabled) childArgs.push('--local-im');
  const child = spawn(process.execPath, childArgs, {
    cwd: rootDir,
    detached: true,
    env: process.env,
    stdio: ['ignore', outFd, errFd],
    windowsHide: true,
  });

  child.unref();
  fs.closeSync(outFd);
  fs.closeSync(errFd);

  const pidFile = daemonPidFile(config);
  await waitForDaemonStart(child.pid, pidFile, 5000);

  console.log('✅ Linco Connect 已在后台启动');
  console.log(`   PID: ${child.pid}`);
  console.log(`   PID 文件: ${pidFile}`);
  console.log(`   标准输出日志: ${logs.stdoutLog}`);
  console.log(`   错误日志: ${logs.stderrLog}`);
}

async function startForeground(config, context = {}) {
  const rootDir = context.rootDir;
  const pidFile = daemonPidFile(config);
  await restartExistingProcessIfRunning(config, context);

  let cleaned = false;
  let shuttingDown = false;
  let server = null;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    removeDaemonPid(pidFile);
  };
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    cleanup();
    stopServer(config, server).finally(() => process.exit(0));
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  process.once('exit', cleanup);

  server = startServer(rootDir, {
    config,
    onListening: () => writeDaemonPid(config, { mode: 'foreground' }, context),
    onClose: cleanup,
  });
}

async function restartExistingProcessIfRunning(config, context = {}) {
  const pidFile = daemonPidFile(config);
  const existing = readDaemonPid(pidFile);
  if (existing?.pid) {
    if (isOwnDaemon(existing, context) && isProcessRunning(existing.pid)) {
      console.log(`Linco Connect 已在运行，正在重启，PID: ${existing.pid}`);
      await stopDaemonProcess(existing.pid);
      console.log(`已停止旧的 Linco Connect 进程，PID: ${existing.pid}`);
    }
    removeDaemonPid(pidFile);
  }
}

function startDaemonChild(config, context = {}) {
  const rootDir = context.rootDir;
  const pidFile = daemonPidFile(config);
  let cleaned = false;
  let shuttingDown = false;
  let server = null;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    removeDaemonPid(pidFile);
  };
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    cleanup();
    stopServer(config, server).finally(() => process.exit(0));
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  process.once('exit', cleanup);

  server = startServer(rootDir, {
    config,
    onListening: () => writeDaemonPid(config, { mode: 'daemon' }, context),
    onClose: cleanup,
  });
}

async function stopCommand(context = {}) {
  const rootDir = context.rootDir;
  const config = loadConfig(rootDir);
  const pidFile = daemonPidFile(config);
  const metadata = readDaemonPid(pidFile);

  if (!metadata?.pid) {
    removeDaemonPid(pidFile);
    console.log('Linco Connect 未在后台运行。');
    return;
  }

  if (!isOwnDaemon(metadata, context)) {
    removeDaemonPid(pidFile);
    console.log(`已清理无效的 PID 文件: ${pidFile}`);
    return;
  }

  if (!isProcessRunning(metadata.pid)) {
    removeDaemonPid(pidFile);
    console.log(`已清理失效的 PID 文件: ${pidFile}`);
    return;
  }

  await stopDaemonProcess(metadata.pid);

  removeDaemonPid(pidFile);
  console.log(`✅ Linco Connect 已停止，PID: ${metadata.pid}`);
}

async function reloadCommand(context = {}) {
  const rootDir = context.rootDir;
  const config = loadConfig(rootDir);
  try {
    const result = await sendControlCommand(config, 'reload');
    if (!result?.ok) {
      throw new Error(result?.error || 'reload failed');
    }
    console.log('✅ Linco Connect 配置已重载');
    console.log(`   配置文件: ${result.configFile || config.configFile}`);
    console.log(`   远端 IM: ${result.imEnabled ? '已启用' : '未启用'}`);
    console.log(`   Agent: ${(result.agents || []).join(', ') || 'none'}`);
  } catch (err) {
    throw new Error(`无法重载运行中的 Linco Connect: ${err.message}。请确认服务正在运行，或重启 linco-connect。`);
  }
}

function statusCommand(context = {}) {
  const rootDir = context.rootDir;
  const config = loadConfig(rootDir);
  const pidFile = daemonPidFile(config);
  const metadata = readDaemonPid(pidFile);

  if (!metadata?.pid) {
    console.log('Linco Connect 未运行');
    console.log(`PID 文件: ${pidFile}`);
    process.exitCode = 1;
    return;
  }

  if (!isOwnDaemon(metadata, context)) {
    console.log('Linco Connect 状态未知：PID 文件不属于当前安装');
    console.log(`PID 文件: ${pidFile}`);
    console.log(`PID: ${metadata.pid}`);
    if (metadata.app) console.log(`App: ${metadata.app}`);
    if (metadata.cli) console.log(`CLI: ${metadata.cli}`);
    process.exitCode = 1;
    return;
  }

  if (!isProcessRunning(metadata.pid)) {
    removeDaemonPid(pidFile);
    console.log('Linco Connect 未运行（已清理失效 PID 文件）');
    console.log(`PID 文件: ${pidFile}`);
    process.exitCode = 1;
    return;
  }

  const enabledAgents = Object.entries(config.agents || {})
    .filter(([, agent]) => agent.enabled)
    .map(([type]) => type)
    .join(', ') || 'none';

  console.log('Linco Connect 正在运行');
  console.log(`PID: ${metadata.pid}`);
  console.log(`模式: ${metadata.mode || 'unknown'}`);
  console.log(`启动时间: ${metadata.startedAt || 'unknown'}`);
  console.log(`运行目录: ${metadata.cwd || rootDir}`);
  console.log(`Linco Home: ${config.lincoHome}`);
  console.log(`远端 IM: ${config.im?.enabled ? `已启用 (${config.im.channel}/${config.im.account})` : '未启用'}`);
  console.log(`Agent: ${enabledAgents}`);
  if (metadata.stdoutLog) console.log(`标准输出日志: ${metadata.stdoutLog}`);
  if (metadata.stderrLog) console.log(`错误日志: ${metadata.stderrLog}`);
}

async function stopDaemonProcess(pid) {
  process.kill(pid, 'SIGTERM');
  const stopped = await waitForProcessExit(pid, 5000);
  if (!stopped && isProcessRunning(pid)) {
    process.kill(pid, 'SIGKILL');
    const killed = await waitForProcessExit(pid, 2000);
    if (!killed && isProcessRunning(pid)) {
      throw new Error(`停止失败，进程仍在运行，PID: ${pid}`);
    }
  }
}

function daemonPidFile(config) {
  return path.join(config.lincoHome, 'linco-connect.pid');
}

function daemonLogFiles(config) {
  ensureDir(config.logsDir);
  return {
    stdoutLog: path.join(config.logsDir, 'daemon.out.log'),
    stderrLog: path.join(config.logsDir, 'daemon.err.log'),
  };
}

function readDaemonPid(pidFile) {
  try {
    return JSON.parse(fs.readFileSync(pidFile, 'utf8'));
  } catch {
    return null;
  }
}

function writeDaemonPid(config, options = {}, context = {}) {
  const rootDir = context.rootDir;
  const cliFile = context.cliFile;
  ensureDir(config.lincoHome);
  const logs = daemonLogFiles(config);
  fs.writeFileSync(daemonPidFile(config), `${JSON.stringify({
    app: pkg.name,
    cli: cliFile,
    cwd: rootDir,
    pid: process.pid,
    mode: options.mode || 'daemon',
    startedAt: new Date().toISOString(),
    host: config.host,
    port: config.port,
    ...logs,
  }, null, 2)}\n`);
}

function isOwnDaemon(metadata, context = {}) {
  return metadata?.app === pkg.name && metadata?.cli === context.cliFile;
}

function removeDaemonPid(pidFile) {
  try {
    fs.rmSync(pidFile, { force: true });
  } catch {}
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitForProcessExit(pid, timeoutMs) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (!isProcessRunning(pid)) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 100);
  });
}

function waitForDaemonStart(pid, pidFile, timeoutMs) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      const metadata = readDaemonPid(pidFile);
      if (metadata?.pid === pid && isProcessRunning(pid)) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (!isProcessRunning(pid)) {
        clearInterval(timer);
        reject(new Error(`后台进程启动失败，请查看日志。PID 文件: ${pidFile}`));
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        reject(new Error(`后台进程启动超时，请查看日志。PID 文件: ${pidFile}`));
      }
    }, 100);
  });
}

module.exports = {
  startCommand,
  startDaemon,
  startForeground,
  restartExistingProcessIfRunning,
  startDaemonChild,
  stopCommand,
  reloadCommand,
  statusCommand,
  stopDaemonProcess,
  daemonPidFile,
  daemonLogFiles,
  readDaemonPid,
  writeDaemonPid,
  isOwnDaemon,
  removeDaemonPid,
  isProcessRunning,
  waitForProcessExit,
  waitForDaemonStart,
};
