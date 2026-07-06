const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { saveUserConfig } = require('../../src/config');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-config-backup-'));
const configFile = path.join(tempDir, 'config.json');

try {
  saveUserConfig({ version: 1 }, configFile);
  assert.deepStrictEqual(listBackups(tempDir), []);

  saveUserConfig({ version: 2 }, configFile);

  const backups = listBackups(tempDir);
  assert.strictEqual(backups.length, 1);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(tempDir, backups[0]), 'utf8')), { version: 1 });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(configFile, 'utf8')), { version: 2 });
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

function listBackups(dir) {
  return fs.readdirSync(dir)
    .filter(name => /^config\.json\.\d{8}T\d{6}Z\.bak$/.test(name))
    .sort();
}

console.log('config backup ok');
