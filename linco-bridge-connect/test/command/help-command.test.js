const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..');
const cli = path.join(rootDir, 'bin', 'linco-connect.js');

const result = spawnSync(process.execPath, [cli, '--help'], {
  cwd: rootDir,
  encoding: 'utf8',
});
const output = `${result.stdout}\n${result.stderr}`;

assert.strictEqual(result.status, 0, output);
assert.match(output, /linco-connect init --token "appId:appSecret" --agent codex/);
assert.match(output, /--app-id appId --app-secret appSecret --agent claude/);
assert.match(output, /\[--channel linco-demo\]/);
assert.match(output, /--agent\s+指定 Agent 类型: claude, codex, hermes, openclaw/);
assert.match(output, /--token "appId:appSecret"\s+推荐写法/);
assert.match(output, /--ws-url <url>\s+覆盖远端 WebSocket 地址/);
assert.match(output, /--allow-insecure-ws\s+允许 ws:\/\//);

console.log('help command ok');
