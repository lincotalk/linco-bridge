const {
  getCurrentVersion,
  getPackageInfo,
  readUpdateStatus,
  requestCurrentProcessShutdown,
  resolveTargetVersion,
  scheduleSelfUpdate,
} = require('../app/selfUpdate');
const { sendError, sendSystem } = require('../core/protocol');
const { splitCommandArgs } = require('./args');

async function handleUpdate(rawArg, ws, session, config = {}, options = {}) {
  const parsed = parseUpdateArgs(rawArg);
  if (!parsed.ok) {
    sendError(ws, parsed.message);
    return { handled: true, shutdownScheduled: false };
  }

  const deps = {
    getPackageInfo: options.getPackageInfo || getPackageInfo,
    readUpdateStatus: options.readUpdateStatus || readUpdateStatus,
    resolveTargetVersion: options.resolveTargetVersion || resolveTargetVersion,
    scheduleSelfUpdate: options.scheduleSelfUpdate || scheduleSelfUpdate,
    requestCurrentProcessShutdown: options.requestCurrentProcessShutdown || requestCurrentProcessShutdown,
  };

  if (parsed.mode === 'status') {
    const status = deps.readUpdateStatus(config);
    sendUpdateResult(ws, 'status', {
      currentVersion: getCurrentVersion(),
      status,
    });
    sendSystem(ws, formatUpdateStatus(status));
    return { handled: true, shutdownScheduled: false };
  }

  if (parsed.mode === 'list' || parsed.mode === 'check') {
    const info = await deps.getPackageInfo();
    const data = buildVersionData(info, parsed.limit);
    sendUpdateResult(ws, parsed.mode, data);
    sendSystem(ws, parsed.mode === 'check' ? formatUpdateCheck(data) : formatUpdateList(data));
    return { handled: true, shutdownScheduled: false };
  }

  const resolved = await deps.resolveTargetVersion(parsed.target);
  const targetVersion = resolved.targetVersion;
  const currentVersion = getCurrentVersion();
  if (targetVersion === currentVersion && !parsed.force) {
    sendUpdateResult(ws, 'install', {
      currentVersion,
      latestVersion: resolved.latest,
      targetVersion,
      skipped: true,
      reason: 'same_version',
    });
    sendSystem(ws, `Linco Connect 当前已经是 ${targetVersion}。如需重新安装同版本，请使用 /update ${targetVersion} --force。`);
    return { handled: true, shutdownScheduled: false };
  }

  const scheduled = deps.scheduleSelfUpdate(config, targetVersion);
  sendUpdateResult(ws, 'install', {
    currentVersion,
    latestVersion: resolved.latest,
    targetVersion,
    fromVersion: scheduled.fromVersion,
    runnerPid: scheduled.runnerPid,
    statusFile: scheduled.statusFile,
    logFile: scheduled.logFile,
    daemonAfterInstall: true,
  });
  sendSystem(ws, [
    `Linco Connect 将从 ${currentVersion} 安装到 ${targetVersion}。`,
    '安装完成后会自动以后台服务方式启动，手机端稍后会自动重新连上。',
    `更新日志: ${scheduled.logFile}`,
  ].join('\n'));
  deps.requestCurrentProcessShutdown(1200);
  return { handled: true, shutdownScheduled: true };
}

function parseUpdateArgs(rawArg) {
  const parsed = splitCommandArgs(rawArg);
  if (!parsed.ok) return parsed;
  const args = parsed.args;
  let mode = args[0] ? String(args[0]).trim().toLowerCase() : 'check';
  let target = '';
  let force = false;
  let limit = 20;

  if (mode === 'install') {
    target = args[1] ? String(args[1]).trim() : 'latest';
    args.splice(0, Math.min(args.length, 2), target);
    mode = target;
  }

  for (const arg of args.slice(1)) {
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length));
      if (!Number.isInteger(value) || value <= 0) {
        return { ok: false, message: '用法: /update list --limit=20' };
      }
      limit = Math.min(value, 100);
      continue;
    }
    return { ok: false, message: '用法: /update [check|list|status|latest|<version>] [--force]' };
  }

  if (mode === 'versions') mode = 'list';
  if (mode === 'current') mode = 'check';
  if (['check', 'list', 'status'].includes(mode)) {
    return { ok: true, mode, force, limit };
  }
  if (mode === 'latest' || isVersionLike(mode)) {
    target = mode;
    return { ok: true, mode: 'install', target, force, limit };
  }
  return { ok: false, message: '用法: /update [check|list|status|latest|<version>] [--force]' };
}

function isVersionLike(value) {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(value || ''));
}

function buildVersionData(info, limit) {
  const versions = Array.isArray(info.versions) ? info.versions : [];
  const recentVersions = versions.slice(-limit).reverse();
  const currentVersion = getCurrentVersion();
  return {
    packageName: info.name,
    currentVersion,
    latestVersion: info.latest,
    updateAvailable: Boolean(info.latest && info.latest !== currentVersion),
    totalVersions: versions.length,
    returnedCount: recentVersions.length,
    versions: recentVersions,
  };
}

function sendUpdateResult(ws, command, data = {}) {
  ws.send(JSON.stringify({
    type: 'slash_command_result',
    command: 'update',
    version: 1,
    data: {
      action: command,
      ...data,
    },
  }));
}

function formatUpdateCheck(data) {
  return [
    `Linco Connect 当前版本: ${data.currentVersion}`,
    `npm 最新版本: ${data.latestVersion || '(unknown)'}`,
    data.updateAvailable
      ? `可升级: /update latest`
      : '当前已是最新版本。',
  ].join('\n');
}

function formatUpdateList(data) {
  const lines = [
    `Linco Connect 当前版本: ${data.currentVersion}`,
    `npm 最新版本: ${data.latestVersion || '(unknown)'}`,
    `可安装版本（最近 ${data.returnedCount}/${data.totalVersions} 个）:`,
    ...data.versions.map(version => `- ${version}${version === data.currentVersion ? ' (current)' : ''}`),
    '',
    '安装指定版本: /update <version>',
    '安装最新版本: /update latest',
  ];
  return lines.join('\n');
}

function formatUpdateStatus(status) {
  if (!status) return '还没有本机升降级记录。';
  const lines = [
    `最近一次升降级状态: ${status.state || 'unknown'}`,
    `目标版本: ${status.targetVersion || '(unknown)'}`,
  ];
  if (status.fromVersion) lines.push(`原版本: ${status.fromVersion}`);
  if (status.updatedAt) lines.push(`更新时间: ${status.updatedAt}`);
  if (status.error) lines.push(`错误: ${status.error}`);
  if (status.startError) lines.push(`启动错误: ${status.startError}`);
  if (status.logFile) lines.push(`日志: ${status.logFile}`);
  return lines.join('\n');
}

module.exports = {
  handleUpdate,
  parseUpdateArgs,
  _internal: {
    buildVersionData,
    formatUpdateCheck,
    formatUpdateList,
    formatUpdateStatus,
  },
};
