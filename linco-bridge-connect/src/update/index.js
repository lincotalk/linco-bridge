const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const pkg = require('../../package.json');

const PACKAGE_NAME = pkg.name || 'linco-connect';
const STATUS_FILE = 'linco-update-status.json';
const RUNNER_FILE = 'linco-update-runner.cjs';
const PAYLOAD_FILE = 'linco-update-payload.json';

function getCurrentVersion() {
  return pkg.version || '';
}

function statusFilePath(config = {}) {
  return path.join(config.lincoHome || process.cwd(), STATUS_FILE);
}

function readUpdateStatus(config = {}) {
  try {
    return JSON.parse(fs.readFileSync(statusFilePath(config), 'utf8'));
  } catch {
    return null;
  }
}

async function getPackageInfo(options = {}) {
  const npmBin = options.npmBin || resolveNpmBin();
  const data = await execNpmJson(npmBin, ['view', PACKAGE_NAME, 'name', 'version', 'versions', '--json'], options);
  return normalizePackageInfo(data);
}

function normalizePackageInfo(data) {
  const versions = Array.isArray(data?.versions)
    ? data.versions.map(String)
    : data?.versions
      ? [String(data.versions)]
      : [];
  return {
    name: String(data?.name || PACKAGE_NAME),
    latest: String(data?.version || versions.at(-1) || ''),
    versions,
  };
}

async function resolveTargetVersion(target, options = {}) {
  const info = await getPackageInfo(options);
  const requested = String(target || 'latest').trim().toLowerCase();
  const version = !requested || requested === 'latest' ? info.latest : String(target).trim();
  if (!version) {
    throw new Error('No installable version was returned by npm.');
  }
  if (!isSafeVersion(version)) {
    throw new Error(`Invalid version: ${version}`);
  }
  if (!info.versions.includes(version)) {
    throw new Error(`Version ${version} is not available for ${PACKAGE_NAME}.`);
  }
  return { ...info, targetVersion: version };
}

function isSafeVersion(value) {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(value || ''));
}

function scheduleSelfUpdate(config = {}, targetVersion, options = {}) {
  if (!isSafeVersion(targetVersion)) {
    throw new Error(`Invalid version: ${targetVersion}`);
  }
  const rootDir = path.resolve(__dirname, '..', '..');
  if (isSourceCheckout(rootDir) && process.env.LINCO_ALLOW_SOURCE_SELF_UPDATE !== '1') {
    throw new Error('Self update is only supported for the npm-installed package. Source checkout runs can set LINCO_ALLOW_SOURCE_SELF_UPDATE=1 for development testing.');
  }

  const lincoHome = config.lincoHome || path.join(process.cwd(), '.linco');
  const logsDir = config.logsDir || path.join(lincoHome, 'logs');
  fs.mkdirSync(lincoHome, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });

  const runnerPath = path.join(lincoHome, RUNNER_FILE);
  const payloadPath = path.join(lincoHome, PAYLOAD_FILE);
  const logFile = path.join(logsDir, `update-${Date.now()}.log`);
  const payload = {
    packageName: PACKAGE_NAME,
    fromVersion: getCurrentVersion(),
    targetVersion,
    currentPid: process.pid,
    lincoHome,
    logsDir,
    statusFile: statusFilePath(config),
    npmBin: options.npmBin || process.env.LINCO_UPDATE_NPM_BIN || resolveNpmBin(),
    cliPath: path.join(rootDir, 'bin', 'linco-connect.js'),
    rootDir,
    workDir: lincoHome,
    logFile,
    localIm: config.localWeb?.imEnabled === true,
    waitTimeoutMs: options.waitTimeoutMs || 30000,
  };

  writeStatus(payload.statusFile, {
    state: 'scheduled',
    packageName: PACKAGE_NAME,
    fromVersion: payload.fromVersion,
    targetVersion,
    updatedAt: new Date().toISOString(),
    pid: process.pid,
    logFile,
  });
  fs.writeFileSync(runnerPath, `${buildRunnerScript()}\n`, 'utf8');
  fs.writeFileSync(payloadPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const outFd = fs.openSync(logFile, 'a');
  const spawnImpl = options.spawn || spawn;
  const child = spawnImpl(process.execPath, [runnerPath, payloadPath], {
    cwd: lincoHome,
    detached: true,
    env: process.env,
    stdio: ['ignore', outFd, outFd],
    windowsHide: true,
  });
  child.unref();
  fs.closeSync(outFd);

  return {
    packageName: PACKAGE_NAME,
    fromVersion: payload.fromVersion,
    targetVersion,
    runnerPid: child.pid,
    statusFile: payload.statusFile,
    logFile,
  };
}

function requestCurrentProcessShutdown(delayMs = 800) {
  const timer = setTimeout(() => {
    try {
      process.kill(process.pid, 'SIGTERM');
    } catch {
      process.exit(0);
    }
  }, delayMs);
  timer.unref?.();
}

function resolveNpmBin() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function execNpmJson(npmBin, args, options = {}) {
  const exec = options.execFile || execFile;
  return new Promise((resolve, reject) => {
    exec(npmBin, args, {
      shell: process.platform === 'win32' && isShellScriptCommand(npmBin),
      windowsHide: true,
      timeout: options.timeoutMs || 15000,
      maxBuffer: options.maxBuffer || 1024 * 1024,
    }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error((stderr || err.message || '').trim() || err.message));
        return;
      }
      try {
        resolve(JSON.parse(stdout || '{}'));
      } catch (parseErr) {
        reject(new Error(`Failed to parse npm response: ${parseErr.message}`));
      }
    });
  });
}

function isSourceCheckout(rootDir) {
  let current = path.resolve(rootDir);
  while (current && current !== path.dirname(current)) {
    if (path.basename(current) === 'node_modules') return false;
    if (fs.existsSync(path.join(current, '.git'))) return true;
    current = path.dirname(current);
  }
  return false;
}

function isShellScriptCommand(command) {
  return /\.(?:cmd|bat)$/i.test(String(command || ''));
}

function writeStatus(file, payload) {
  try {
    fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  } catch {}
}

function buildRunnerScript() {
  return String.raw`const fs = require('fs');
const { spawn } = require('child_process');

const payloadFile = process.argv[2];
const payload = JSON.parse(fs.readFileSync(payloadFile, 'utf8'));

function writeStatus(patch) {
  const next = {
    packageName: payload.packageName,
    fromVersion: payload.fromVersion,
    targetVersion: payload.targetVersion,
    updatedAt: new Date().toISOString(),
    logFile: payload.logFile,
    ...patch,
  };
  try {
    fs.writeFileSync(payload.statusFile, JSON.stringify(next, null, 2) + '\n', 'utf8');
  } catch {}
}

function isRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForExit(pid, timeoutMs) {
  const startedAt = Date.now();
  while (isRunning(pid)) {
    if (Date.now() - startedAt >= timeoutMs) return false;
    await sleep(250);
  }
  return true;
}

function run(command, args, label, options = {}) {
  return new Promise((resolve, reject) => {
    writeStatus({ state: label });
    const child = spawn(command, args, {
      cwd: options.cwd || payload.workDir || process.cwd(),
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32' && options.shell !== false,
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(label + ' failed with ' + (signal || code)));
    });
  });
}

async function startDaemon(options = {}) {
  if (options.preferInstalled !== false) {
    const commandArgs = ['start', '--daemon'];
    if (payload.localIm) commandArgs.push('--local-im');
    try {
      await run(payload.packageName, commandArgs, 'starting');
      return;
    } catch (err) {
      writeStatus({ state: 'starting_path_fallback', startError: err && err.message ? err.message : String(err) });
    }
  }

  const args = [payload.cliPath, 'start', '--daemon'];
  if (payload.localIm) args.push('--local-im');
  if (fs.existsSync(payload.cliPath)) {
    try {
      await run(process.execPath, args, 'starting', { shell: false });
      return;
    } catch (err) {
      writeStatus({ state: 'starting_fallback', startError: err && err.message ? err.message : String(err) });
    }
  }
  const commandArgs = ['start', '--daemon'];
  if (payload.localIm) commandArgs.push('--local-im');
  await run(payload.packageName, commandArgs, 'starting');
}

(async () => {
  try {
    writeStatus({ state: 'waiting_exit', pid: payload.currentPid });
    const exited = await waitForExit(payload.currentPid, payload.waitTimeoutMs || 30000);
    if (!exited) {
      try {
        process.kill(payload.currentPid, 'SIGTERM');
      } catch {}
      await waitForExit(payload.currentPid, 10000);
    }

    await run(payload.npmBin, ['install', '-g', payload.packageName + '@' + payload.targetVersion], 'installing');
    writeStatus({ state: 'installed' });
    await startDaemon({ preferInstalled: true });
    writeStatus({ state: 'success' });
  } catch (err) {
    writeStatus({ state: 'failed', error: err && err.message ? err.message : String(err) });
    try {
      await startDaemon({ preferInstalled: false });
    } catch (startErr) {
      writeStatus({
        state: 'failed',
        error: err && err.message ? err.message : String(err),
        startError: startErr && startErr.message ? startErr.message : String(startErr),
      });
    }
    process.exitCode = 1;
  }
})();`;
}

module.exports = {
  getCurrentVersion,
  getPackageInfo,
  readUpdateStatus,
  requestCurrentProcessShutdown,
  resolveTargetVersion,
  scheduleSelfUpdate,
  statusFilePath,
  _internal: {
    buildRunnerScript,
    isSafeVersion,
    isSourceCheckout,
    isShellScriptCommand,
    normalizePackageInfo,
    resolveNpmBin,
  },
};
