const assert = require('assert');
const os = require('os');
const path = require('path');
const { handleUpdate, parseUpdateArgs } = require('../../src/commands/update');
const pkg = require('../../package.json');

function createCaptureWs() {
  const sent = [];
  return {
    sent,
    send(raw) {
      sent.push(JSON.parse(raw));
    },
  };
}

function createSession(id = 'session-update') {
  return {
    id,
    linco: { messageId: `m-${id}`, streamId: `stream-${id}` },
    messageQueue: [],
    agentSessionHistory: [],
  };
}

(async () => {
  {
    assert.deepStrictEqual(parseUpdateArgs(''), {
      ok: true,
      mode: 'check',
      force: false,
      limit: 20,
    });
    assert.deepStrictEqual(parseUpdateArgs('latest --force'), {
      ok: true,
      mode: 'install',
      target: 'latest',
      force: true,
      limit: 20,
    });
    assert.deepStrictEqual(parseUpdateArgs('1.2.8'), {
      ok: true,
      mode: 'install',
      target: '1.2.8',
      force: false,
      limit: 20,
    });
    assert.deepStrictEqual(parseUpdateArgs('install 1.2.8 --force'), {
      ok: true,
      mode: 'install',
      target: '1.2.8',
      force: true,
      limit: 20,
    });
  }

  {
    const ws = createCaptureWs();
    const result = await handleUpdate('list --limit=2', ws, createSession(), {}, {
      getPackageInfo: async () => ({
        name: 'linco-connect',
        latest: '1.2.9',
        versions: ['1.2.7', '1.2.8', '1.2.9'],
      }),
    });

    assert.strictEqual(result.shutdownScheduled, false);
    assert.strictEqual(ws.sent[0].type, 'slash_command_result');
    assert.strictEqual(ws.sent[0].command, 'update');
    assert.strictEqual(ws.sent[0].data.action, 'list');
    assert.deepStrictEqual(ws.sent[0].data.versions, ['1.2.9', '1.2.8']);
    assert.strictEqual(ws.sent[1].type, 'system');
    assert.match(ws.sent[1].text, /\/update <version>/);
  }

  {
    const ws = createCaptureWs();
    const result = await handleUpdate(pkg.version, ws, createSession(), {}, {
      resolveTargetVersion: async () => ({
        name: 'linco-connect',
        latest: pkg.version,
        versions: [pkg.version],
        targetVersion: pkg.version,
      }),
    });

    assert.strictEqual(result.shutdownScheduled, false);
    assert.strictEqual(ws.sent[0].data.skipped, true);
    assert.match(ws.sent[1].text, new RegExp(pkg.version.replaceAll('.', '\\.')));
  }

  {
    const tempDir = path.join(os.tmpdir(), 'linco-update-test');
    const ws = createCaptureWs();
    let scheduledTarget = '';
    let shutdownDelay = 0;
    const result = await handleUpdate('1.2.8', ws, createSession(), {
      lincoHome: tempDir,
      logsDir: path.join(tempDir, 'logs'),
    }, {
      resolveTargetVersion: async () => ({
        name: 'linco-connect',
        latest: '1.2.9',
        versions: ['1.2.8', '1.2.9'],
        targetVersion: '1.2.8',
      }),
      scheduleSelfUpdate: (_config, targetVersion) => {
        scheduledTarget = targetVersion;
        return {
          fromVersion: '1.2.9',
          targetVersion,
          runnerPid: 12345,
          statusFile: path.join(tempDir, 'linco-update-status.json'),
          logFile: path.join(tempDir, 'logs', 'update.log'),
        };
      },
      requestCurrentProcessShutdown: (delayMs) => {
        shutdownDelay = delayMs;
      },
    });

    assert.strictEqual(result.shutdownScheduled, true);
    assert.strictEqual(scheduledTarget, '1.2.8');
    assert.strictEqual(shutdownDelay, 1200);
    assert.strictEqual(ws.sent[0].data.daemonAfterInstall, true);
    assert.match(ws.sent[1].text, /安装完成后会自动以后台服务方式启动/);
  }

  console.log('update command ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
