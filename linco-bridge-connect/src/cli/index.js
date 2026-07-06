const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { startServer, stopServer } = require('../app/serverApp');
const {
  ensureDir,
  findGitBash,
  getConfigFile,
  getChannelPreset,
  loadConfig,
  parseToken,
  readUserConfig,
  removeConfiguredAccount,
  resolveCommand,
  saveUserConfig,
} = require('../config');
const { ensureLocalToken, localUrlWithToken } = require('../app/localAuth');
const { sendControlCommand } = require('../app/controlServer');
const { checkGatewayHealth, resolveHermesGatewayOptions } = require('../gateways/hermesGateway');
const {
  checkGatewayHealth: checkOpenClawGatewayHealth,
  resolveOpenClawGatewayOptions,
} = require('../gateways/openclawGateway');
const pkg = require('../../package.json');

const rootDir = path.resolve(__dirname, '..', '..');

if (require.main === module) {
  main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0] && !argv[0].startsWith('-') ? argv.shift() : 'help';
  const options = parseArgs(argv);

  if (options.version || command === 'version') {
    console.log(pkg.version);
    return;
  }

  if (options.help || command === 'help') {
    printHelp();
    return;
  }

  switch (command) {
    case 'init':
      initCommand(options);
      break;
    case 'remove-account':
    case 'delete-account':
      removeAccountCommand(options);
      break;
    case 'ws-prefix':
      wsPrefixCommand(options);
      break;
    case 'start':
      await startCommand(options);
      break;
    case 'stop':
      await stopCommand();
      break;
    case 'reload':
      await reloadCommand();
      break;
    case 'status':
      statusCommand();
      break;
    case 'doctor':
      await doctorCommand();
      break;
    default:
      throw new Error(`未知命令: ${command}\n运行 linco-connect --help 查看用法。`);
  }
}

function parseArgs(args) {
  const options = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      options._.push(arg);
      continue;
    }

    const eq = arg.indexOf('=');
    const key = eq > 2 ? arg.slice(2, eq) : arg.slice(2);
    const value = eq > 2 ? arg.slice(eq + 1) : args[i + 1];

    if (['force', 'help', 'version', 'daemon', 'daemon-child', 'local-im', 'mock-im', 'clear', 'allow-insecure-ws'].includes(key)) {
      options[key] = true;
      continue;
    }

    if (value == null || String(value).startsWith('--')) {
      throw new Error(`参数 --${key} 缺少值`);
    }
    options[key] = value;
    if (eq < 0) i += 1;
  }
  return options;
}

function initCommand(options) {
  const tokenValue = options.token || process.env.LINCO_TOKEN || '';
  const token = parseToken(tokenValue);
  const appId = options['app-id'] || token.appId;
  const appSecret = options['app-secret'] || token.appSecret;

  if (!appId || !appSecret) {
    throw new Error('请提供 --token "appId:appSecret"，或同时提供 --app-id 与 --app-secret。');
  }

  const account = options.account || 'default';
  const agentType = options.agent ? options.agent.trim().toLowerCase() : null;
  const channel = options.channel ? String(options.channel).trim() : 'linco';
  const wsUrl = options['ws-url'] ? String(options['ws-url']).trim() : '';
  if (!channel) throw new Error('参数 --channel 不能为空');
  const configFile = getConfigFile();
  const current = readUserConfig(configFile);

  if (fs.existsSync(configFile) && !options.force) {
    const existingAccount = current.channels?.[channel]?.agents?.[agentType || 'claude']?.accounts?.[account];
    if (existingAccount?.appId || existingAccount?.appSecret || existingAccount?.token) {
      throw new Error(`配置已存在，如需覆盖请添加 --force。配置文件: ${configFile}`);
    }
  }

  if (agentType) {
    // Hermes is an HTTP gateway service, not a CLI binary
    if (agentType !== 'hermes') {
      const agentBin = resolveCommand(agentType);
      if (!agentBin || !commandExists(agentType)) {
        throw new Error(`未检测到 ${agentType} CLI，请先安装 ${agentType} 再初始化。`);
      }
    }
  }

  const next = mergeInitConfig(current, {
    appId,
    appSecret,
    account,
    agentType,
    channel,
    wsUrl,
    allowInsecureWs: options['allow-insecure-ws'] === true,
  });
  saveUserConfig(next, configFile);

  const config = loadConfig(rootDir);
  ensureLocalToken(config);

  console.log('✅ Linco Connect 初始化完成');
  console.log(`   配置文件: ${config.configFile}`);
  console.log(`   账号: ${account}`);
  if (agentType) {
    console.log(`   Agent 类型: ${agentType}`);
  }
  console.log('   下一步: linco-connect doctor && linco-connect start');
}

function commandExists(command) {
  try {
    const detector = process.platform === 'win32' ? 'where.exe' : 'which';
    const args = [command];
    execFileSync(detector, args, { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function mergeInitConfig(current, values) {
  const accountEntry = {
    appId: values.appId,
    appSecret: values.appSecret,
    enabled: true,
  };
  if (values.wsUrl) accountEntry.wsUrl = values.wsUrl;
  if (values.allowInsecureWs) accountEntry.allowInsecureWs = true;
  if (values.agentType === 'openclaw') accountEntry.openclawAgentId = 'main';
  const agentType = values.agentType || 'claude';
  const channel = values.channel || 'linco';
  const currentChannel = current.channels?.[channel] || {};
  const currentAgent = currentChannel.agents?.[agentType] || {};
  const currentAccounts = currentAgent.accounts || {};

  return {
    ...current,
    defaultChannel: channel,
    defaultAgent: agentType,
    activeChannels: mergeActiveChannels(current, channel),
    channels: {
      ...(current.channels || {}),
      [channel]: {
        ...currentChannel,
        agents: {
          ...(currentChannel.agents || {}),
          [agentType]: {
            ...currentAgent,
            defaultAccount: values.account,
            accounts: {
              ...currentAccounts,
              [values.account]: {
                ...(currentAccounts[values.account] || {}),
                ...accountEntry,
              },
            },
          },
        },
      },
    },
    localWeb: {
      ...(current.localWeb || {}),
    },
  };
}

function mergeActiveChannels(current, channel) {
  const existing = Array.isArray(current.activeChannels)
    ? current.activeChannels
    : String(current.activeChannels || '').split(',');
  const seeded = existing
    .map(item => String(item || '').trim())
    .filter(Boolean);

  if (seeded.length === 0 && current.defaultChannel) {
    seeded.push(String(current.defaultChannel).trim());
  }
  seeded.push(channel);

  return Array.from(new Set(seeded.filter(Boolean)));
}

function removeAccountCommand(options) {
  const configFile = getConfigFile();
  const current = readUserConfig(configFile);
  const result = removeConfiguredAccount(current, {
    account: options.account,
    agent: options.agent,
    channel: options.channel,
  });

  saveUserConfig(result.config, configFile);

  console.log(`已删除账号: ${result.channelName}/${result.agentType}/${result.account}`);
  if (result.agentDefaultAccount) {
    console.log(`当前 ${result.agentType} 默认账号: ${result.agentDefaultAccount}`);
  }
  if (result.defaultAgent) {
    console.log(`当前默认 Agent: ${result.defaultAgent}`);
  }
  console.log(`配置文件: ${configFile}`);
}

function wsPrefixCommand(options) {
  const configFile = getConfigFile();
  const current = readUserConfig(configFile);
  const channelName = String(options.channel || current.defaultChannel || 'linco').trim() || 'linco';
  const channel = current.channels?.[channelName];
  const agents = channel?.agents || {};
  const prefix = options._[0];

  if (options._.length > 1) {
    throw new Error('Usage: linco-connect ws-prefix <domain-or-url> or linco-connect ws-prefix --clear');
  }
  if (!options.clear && !prefix) {
    throw new Error('Usage: linco-connect ws-prefix <domain-or-url>');
  }
  if (options.clear && prefix) {
    throw new Error('Usage: linco-connect ws-prefix --clear');
  }

  const entries = collectConfiguredAccounts(agents, options.agent);
  if (entries.length === 0) {
    throw new Error(`No configured accounts found in channel: ${channelName}`);
  }

  const nextAgents = { ...agents };
  const changed = [];
  for (const entry of entries) {
    const nextAgent = {
      ...nextAgents[entry.agentType],
      accounts: {
        ...(nextAgents[entry.agentType].accounts || {}),
      },
    };
    const nextAccount = {
      ...(nextAgent.accounts[entry.account] || {}),
    };

    if (options.clear) {
      if (!Object.prototype.hasOwnProperty.call(nextAccount, 'wsUrl')) continue;
      delete nextAccount.wsUrl;
      changed.push({ ...entry });
    } else {
      const wsUrl = buildAgentWsUrl(prefix, entry.agentType);
      if (nextAccount.wsUrl === wsUrl) continue;
      nextAccount.wsUrl = wsUrl;
      changed.push({ ...entry, wsUrl });
    }

    nextAgent.accounts[entry.account] = nextAccount;
    nextAgents[entry.agentType] = nextAgent;
  }

  if (changed.length === 0) {
    console.log(options.clear ? 'No wsUrl overrides to clear.' : 'wsUrl overrides are already up to date.');
    return;
  }

  const next = {
    ...current,
    channels: {
      ...(current.channels || {}),
      [channelName]: {
        ...(channel || {}),
        agents: nextAgents,
      },
    },
  };

  saveUserConfig(next, configFile);

  if (options.clear) {
    console.log('Cleared wsUrl overrides:');
    for (const item of changed) {
      console.log(`- ${channelName}/${item.agentType}/${item.account}`);
    }
    console.log('Accounts without wsUrl use the default production endpoint.');
  } else {
    console.log('Updated wsUrl overrides:');
    for (const item of changed) {
      console.log(`- ${channelName}/${item.agentType}/${item.account}: ${item.wsUrl}`);
    }
  }
  console.log(`Config file: ${configFile}`);
}

function collectConfiguredAccounts(agents = {}, requestedAgent) {
  const normalizedAgent = requestedAgent ? String(requestedAgent).trim().toLowerCase() : null;
  return Object.entries(agents)
    .filter(([agentType]) => !normalizedAgent || agentType === normalizedAgent)
    .flatMap(([agentType, agent]) => Object.keys(agent?.accounts || {}).map(account => ({
      agentType,
      account,
    })));
}

function buildAgentWsUrl(prefix, agentType) {
  const base = normalizeWsPrefix(prefix);
  return `${base}/${encodeURIComponent(agentType)}`;
}

function normalizeWsPrefix(prefix) {
  const raw = String(prefix || '').trim();
  if (!raw) throw new Error('ws-prefix cannot be empty.');

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `wss://${raw}`;
  let url;
  try {
    url = new URL(withProtocol);
  } catch (err) {
    throw new Error(`Invalid ws-prefix: ${err.message}`);
  }

  if (!['wss:', 'ws:', 'https:', 'http:'].includes(url.protocol)) {
    throw new Error('ws-prefix protocol must be wss, ws, https, or http.');
  }

  if (url.protocol === 'https:') url.protocol = 'wss:';
  if (url.protocol === 'http:') url.protocol = 'ws:';

  url.search = '';
  url.hash = '';
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = pathname && pathname !== '/' ? pathname : '/socket/ai';

  return url.toString().replace(/\/+$/, '');
}

async function startCommand(options = {}) {
  if (options['local-im'] || options['mock-im']) {
    process.env.LINCO_LOCAL_IM_ENABLED = '1';
  }

  const config = loadConfig(rootDir);
  ensureLocalToken(config);

  if (options.daemon && options['daemon-child']) {
    throw new Error('--daemon 与 --daemon-child 不能同时使用');
  }

  if (options.daemon) {
    await startDaemon(config);
    return;
  }

  if (options['daemon-child']) {
    startDaemonChild(config);
    return;
  }

  await startForeground(config);
}

async function startDaemon(config) {
  ensureDir(config.lincoHome);
  ensureDir(config.logsDir);

  await restartExistingProcessIfRunning(config);

  const logs = daemonLogFiles(config);
  const outFd = fs.openSync(logs.stdoutLog, 'a');
  const errFd = fs.openSync(logs.stderrLog, 'a');
  const childArgs = [__filename, 'start', '--daemon-child'];
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

async function startForeground(config) {
  const pidFile = daemonPidFile(config);
  await restartExistingProcessIfRunning(config);

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
    onListening: () => writeDaemonPid(config, { mode: 'foreground' }),
    onClose: cleanup,
  });
}

async function restartExistingProcessIfRunning(config) {
  const pidFile = daemonPidFile(config);
  const existing = readDaemonPid(pidFile);
  if (existing?.pid) {
    if (isOwnDaemon(existing) && isProcessRunning(existing.pid)) {
      console.log(`Linco Connect 已在运行，正在重启，PID: ${existing.pid}`);
      await stopDaemonProcess(existing.pid);
      console.log(`已停止旧的 Linco Connect 进程，PID: ${existing.pid}`);
    }
    removeDaemonPid(pidFile);
  }
}

function startDaemonChild(config) {
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
    onListening: () => writeDaemonPid(config, { mode: 'daemon' }),
    onClose: cleanup,
  });
}

async function stopCommand() {
  const config = loadConfig(rootDir);
  const pidFile = daemonPidFile(config);
  const metadata = readDaemonPid(pidFile);

  if (!metadata?.pid) {
    removeDaemonPid(pidFile);
    console.log('Linco Connect 未在后台运行。');
    return;
  }

  if (!isOwnDaemon(metadata)) {
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

async function reloadCommand() {
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

function statusCommand() {
  const config = loadConfig(rootDir);
  const pidFile = daemonPidFile(config);
  const metadata = readDaemonPid(pidFile);

  if (!metadata?.pid) {
    console.log('Linco Connect 未运行');
    console.log(`PID 文件: ${pidFile}`);
    process.exitCode = 1;
    return;
  }

  if (!isOwnDaemon(metadata)) {
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

function writeDaemonPid(config, options = {}) {
  ensureDir(config.lincoHome);
  const logs = daemonLogFiles(config);
  fs.writeFileSync(daemonPidFile(config), `${JSON.stringify({
    app: pkg.name,
    cli: __filename,
    cwd: rootDir,
    pid: process.pid,
    mode: options.mode || 'daemon',
    startedAt: new Date().toISOString(),
    host: config.host,
    port: config.port,
    ...logs,
  }, null, 2)}\n`);
}

function isOwnDaemon(metadata) {
  return metadata?.app === pkg.name && metadata?.cli === __filename;
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

async function doctorCommand() {
  const checks = [];
  const config = loadConfig(rootDir);
  ensureLocalToken(config);
  const userConfig = readUserConfig(config.configFile);

  checks.push(['Node.js', Number(process.versions.node.split('.')[0]) >= 18, process.version]);
  checks.push(['配置文件', fs.existsSync(config.configFile), config.configFile]);
  checks.push(['IM token', Boolean(config.im.appId && config.im.appSecret), config.im.appId ? `appId=${config.im.appId}` : '未配置']);
  checks.push(['远端 IM 连接', true, config.im.enabled ? '已启用' : '未启用']);
  checks.push(['远端 IM 地址', Boolean(config.im.wsUrl), safeUrlForDisplay(config.im.wsUrl)]);
  checks.push(['IM 账号', true, `${config.im.channel}/${config.im.account}`]);
  checks.push(['IM Agent', true, config.im.agentId]);
  checks.push(['Active channels', config.activeChannels?.length > 0, (config.activeChannels || []).join(', ') || 'none']);
  checks.push(...channelDoctorChecks(config, userConfig));
  checks.push(['本地测试 token', Boolean(config.localWeb?.token), '已生成']);
  for (const [agentType, agent] of Object.entries(config.agents || {})) {
    checks.push([`${agentType} Agent`, true, agent.enabled ? `已启用 ${safeUrlForDisplay(agent.wsUrl)}` : `未启用 ${safeUrlForDisplay(agent.wsUrl)}`]);
    if (agentType === 'hermes') {
      const options = resolveHermesGatewayOptions(agent);
      const health = await checkGatewayHealth(options.gatewayUrl, agent, { timeoutMs: 3000 });
      if (health.ok) {
        checks.push([`${agentType} Gateway`, true, `${options.gatewayUrl}/health`]);
      } else if (agent.autoStartGateway !== false) {
        const hasCli = !agent.enabled || (path.isAbsolute(options.hermesBin) ? fs.existsSync(options.hermesBin) : commandExists(options.hermesBin));
        checks.push([`${agentType} Gateway`, true, `未运行，发送 Hermes 消息时将自动启动 ${options.gatewayUrl}`]);
        checks.push([`${agentType} CLI`, hasCli, options.hermesBin]);
        checks.push([`${agentType} Profile`, true, options.profileDir]);
      } else {
        checks.push([`${agentType} Gateway`, false, `未运行，且 autoStartGateway=false ${options.gatewayUrl}`]);
      }
    } else if (agentType === 'openclaw') {
      const options = resolveOpenClawGatewayOptions(agent);
      const health = await checkOpenClawGatewayHealth(options.gatewayUrl, agent, { timeoutMs: 3000 });
      if (health.ok) {
        checks.push([`${agentType} Gateway`, true, options.gatewayUrl]);
      } else if (agent.autoStartGateway !== false) {
        const hasCli = !agent.enabled || (path.isAbsolute(options.openclawBin) ? fs.existsSync(options.openclawBin) : commandExists(options.openclawBin));
        checks.push([`${agentType} Gateway`, true, `not running; OpenClaw messages will auto-start ${options.gatewayUrl}`]);
        checks.push([`${agentType} CLI`, hasCli, options.openclawBin]);
      } else {
        checks.push([`${agentType} Gateway`, false, `not running and autoStartGateway=false ${options.gatewayUrl}`]);
      }
      checks.push([`${agentType} Agent ID`, true, agent.openclawAgentId || 'main']);
    } else {
      checks.push([`${agentType} CLI`, !agent.enabled || (path.isAbsolute(agent.bin) ? fs.existsSync(agent.bin) : commandExists(agent.bin)), agent.bin]);
      if (agentType === 'codex') {
        checks.push([`${agentType} Network`, true, agent.networkAccess === false ? 'disabled' : 'enabled']);
      }
    }
  }
  checks.push(['Git Bash', process.platform !== 'win32' || Boolean(findGitBash(userConfig)), process.platform === 'win32' ? (config.gitBashEnv || '未找到') : '非 Windows 不需要']);
  checks.push(['Linco Home', canEnsureWritable(config.lincoHome), config.lincoHome]);
  checks.push(['会话目录', canEnsureWritable(config.sessionsDir), config.sessionsDir]);

  console.log('Linco Connect Doctor\n');
  let ok = true;
  for (const [name, passed, detail] of checks) {
    ok = ok && passed;
    console.log(`${passed ? '✅' : '❌'} ${name}: ${detail}`);
  }
  console.log(`\n本地测试页: ${localUrlWithToken(config)}`);

  if (!ok) process.exitCode = 1;
}

function safeUrlForDisplay(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return value || '未配置';
  }
}

function channelDoctorChecks(config, userConfig) {
  const checks = [];
  const activeChannels = Array.isArray(config.activeChannels) && config.activeChannels.length > 0
    ? config.activeChannels
    : [config.im?.channel || userConfig.defaultChannel || 'linco'];
  const channels = userConfig.channels || {};
  const connectorKeys = new Set((config.im?.connectors || []).map(item => {
    return `${item.channel}:${item.agentType}:${item.account || 'default'}`;
  }));

  for (const channelName of activeChannels) {
    const channelConfig = channels[channelName];
    const preset = getChannelPreset(channelName);
    checks.push([
      `Channel ${channelName}`,
      Boolean(channelConfig),
      channelConfig ? `preset=${preset ? preset.name : 'none'}` : 'missing from config.channels',
    ]);
    if (!channelConfig) continue;

    const enabledAccounts = channelAccountEntries(channelName, channelConfig);
    if (enabledAccounts.length === 0) {
      checks.push([`Channel ${channelName} accounts`, false, 'no enabled accounts']);
      continue;
    }

    for (const entry of enabledAccounts) {
      const key = `${entry.channel}:${entry.agentType}:${entry.account}`;
      const wsUrl = resolvedChannelAccountWsUrl(config, userConfig, entry);
      const hasConnector = connectorKeys.has(key);
      checks.push([
        `Channel ${entry.channel}/${entry.agentType}/${entry.account}`,
        hasConnector,
        wsUrl ? safeUrlForDisplay(wsUrl) : 'missing wsUrl',
      ]);
      checks.push([
        `Credentials ${entry.channel}/${entry.agentType}/${entry.account}`,
        Boolean(entry.accountConfig.appId && entry.accountConfig.appSecret),
        entry.accountConfig.appId ? `appId=${entry.accountConfig.appId}` : 'missing appId/appSecret',
      ]);
      if (wsUrl && /^ws:\/\//i.test(wsUrl)) {
        checks.push([
          `WebSocket security ${entry.channel}/${entry.agentType}/${entry.account}`,
          entry.accountConfig.allowInsecureWs === true || config.im?.allowInsecureWs === true,
          'ws:// requires allowInsecureWs=true',
        ]);
      }
    }
  }

  return checks;
}

function channelAccountEntries(channelName, channelConfig = {}) {
  const entries = [];
  for (const [agentType, agentConfig] of Object.entries(channelConfig.agents || {})) {
    for (const [account, accountConfig] of Object.entries(agentConfig.accounts || {})) {
      if (accountConfig?.enabled !== true) continue;
      entries.push({
        account,
        accountConfig,
        agentConfig,
        agentType,
        channel: channelName,
      });
    }
  }
  return entries;
}

function resolvedChannelAccountWsUrl(config, userConfig, entry) {
  const upperAgentType = entry.agentType.toUpperCase();
  const preset = getChannelPreset(entry.channel);
  return entry.accountConfig.wsUrl
    || process.env[`LINCO_${upperAgentType}_WS_URL`]
    || (entry.agentType === 'claude' ? process.env.LINCO_WS_URL : '')
    || userConfig.agents?.[entry.agentType]?.wsUrl
    || preset?.agentWsUrls?.[entry.agentType]
    || preset?.defaultWsUrl
    || '';
}

function canEnsureWritable(dir) {
  try {
    ensureDir(dir);
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function printHelp() {
  console.log(`Linco Connect ${pkg.version}

用法:
  linco-connect init --token "appId:appSecret" --agent claude [--channel linco] [--account default] [--ws-url wss://...] [--allow-insecure-ws] [--force]
  linco-connect ws-prefix gateway.example.com
  linco-connect ws-prefix --clear
  linco-connect remove-account --agent claude --account default
  linco-connect start [--daemon] [--local-im|--mock-im]
  linco-connect stop
  linco-connect reload
  linco-connect status
  linco-connect doctor

说明:
  init    初始化本地配置，不需要填写 wsUrl
  ws-prefix  按现有账号写入测试环境 wsUrl，或用 --clear 清除覆盖
  remove-account  删除指定 Agent 下的账号配置（delete-account 同义）
  start   启动本机 Agent 连接器（已运行时会先停止旧进程再启动）
  stop    停止运行中的 Linco Connect
  reload  重新读取配置文件并热重载远端 IM 连接
  status  查看 Linco Connect 是否正在运行
  doctor  检查本地运行环境

Agent:
  --agent   指定 Agent 类型，如 claude 或 codex
  --account 指定账号名，默认 default
`);
}

module.exports = {
  main,
};
