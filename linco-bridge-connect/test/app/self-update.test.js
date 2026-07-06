const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  getCurrentVersion,
  resolveTargetVersion,
  scheduleSelfUpdate,
  _internal,
} = require('../../src/app/selfUpdate');
const pkg = require('../../package.json');

(async () => {
  assert.strictEqual(getCurrentVersion(), pkg.version);

  assert.deepStrictEqual(_internal.normalizePackageInfo({
    name: 'linco-connect',
    version: '1.2.9',
    versions: ['1.2.7', '1.2.8', '1.2.9'],
  }), {
    name: 'linco-connect',
    latest: '1.2.9',
    versions: ['1.2.7', '1.2.8', '1.2.9'],
  });

  assert.strictEqual(_internal.isSafeVersion('1.2.9'), true);
  assert.strictEqual(_internal.isSafeVersion('1.2.9-beta.1'), true);
  assert.strictEqual(_internal.isSafeVersion('latest'), false);
  assert.strictEqual(_internal.isSafeVersion('1.2.9 && rm -rf /'), false);
  assert.strictEqual(_internal.isShellScriptCommand('npm.cmd'), true);
  assert.strictEqual(_internal.isShellScriptCommand('npm'), false);

  const execFile = (_bin, _args, _options, callback) => {
    callback(null, JSON.stringify({
      name: 'linco-connect',
      version: '1.2.9',
      versions: ['1.2.8', '1.2.9'],
    }), '');
  };

  const latest = await resolveTargetVersion('latest', { execFile });
  assert.strictEqual(latest.targetVersion, '1.2.9');

  const old = await resolveTargetVersion('1.2.8', { execFile });
  assert.strictEqual(old.targetVersion, '1.2.8');

  await assert.rejects(
    () => resolveTargetVersion('1.2.7', { execFile }),
    /not available/,
  );

  const checkoutRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-source-check-'));
  const packageRoot = path.join(checkoutRoot, 'packages', 'linco-connect');
  fs.mkdirSync(path.join(packageRoot, '.git'), { recursive: true });
  assert.strictEqual(_internal.isSourceCheckout(packageRoot), true);
  fs.rmSync(checkoutRoot, { recursive: true, force: true });

  const globalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-global-install-'));
  const globalPackageRoot = path.join(globalRoot, '.nvm', 'versions', 'node', 'v22.11.0', 'lib', 'node_modules', 'linco-connect');
  fs.mkdirSync(path.join(globalRoot, '.nvm', '.git'), { recursive: true });
  fs.mkdirSync(globalPackageRoot, { recursive: true });
  fs.writeFileSync(path.join(globalPackageRoot, 'package.json'), JSON.stringify({ name: 'linco-connect' }));
  assert.strictEqual(_internal.isSourceCheckout(globalPackageRoot), false);
  fs.rmSync(globalRoot, { recursive: true, force: true });

  const updateHome = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-update-home-'));
  const originalAllow = process.env.LINCO_ALLOW_SOURCE_SELF_UPDATE;
  try {
    process.env.LINCO_ALLOW_SOURCE_SELF_UPDATE = '1';
    let spawned = null;
    const fakeSpawn = (...args) => {
      spawned = args;
      return {
        pid: 1234,
        unref() {},
      };
    };
    const scheduled = scheduleSelfUpdate({
      lincoHome: updateHome,
      logsDir: path.join(updateHome, 'logs'),
    }, '1.2.8', { spawn: fakeSpawn });
    assert.strictEqual(scheduled.targetVersion, '1.2.8');
    assert.strictEqual(spawned[2].cwd, updateHome);
    const payload = JSON.parse(fs.readFileSync(path.join(updateHome, 'linco-update-payload.json'), 'utf8'));
    assert.strictEqual(payload.workDir, updateHome);
  } finally {
    if (originalAllow == null) delete process.env.LINCO_ALLOW_SOURCE_SELF_UPDATE;
    else process.env.LINCO_ALLOW_SOURCE_SELF_UPDATE = originalAllow;
    fs.rmSync(updateHome, { recursive: true, force: true });
  }

  console.log('self update ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
