const fs = require('fs');
const path = require('path');
const { CONFIG_DIR } = require('./defaults');

function getConfigDir() {
  return process.env.LINCO_HOME || CONFIG_DIR;
}

function getConfigFile(configDir = getConfigDir()) {
  return path.join(configDir, 'config.json');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readUserConfig(configFile = getConfigFile()) {
  if (!fs.existsSync(configFile)) return {};

  try {
    return JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch (err) {
    throw new Error(`配置文件读取失败: ${configFile}
${err.message}`);
  }
}

function saveUserConfig(config, configFile = getConfigFile()) {
  ensureDir(path.dirname(configFile));
  backupUserConfig(configFile);
  const tempFile = `${configFile}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempFile, `${JSON.stringify(config, null, 2)}
`);
  fs.renameSync(tempFile, configFile);
}

function updateUserConfig(updater, configFile = getConfigFile()) {
  const current = readUserConfig(configFile);
  const next = updater({ ...current }) || current;
  saveUserConfig(next, configFile);
  return next;
}

function backupUserConfig(configFile) {
  if (!fs.existsSync(configFile)) return null;

  const backupFile = `${configFile}.${backupTimestamp()}.bak`;
  fs.copyFileSync(configFile, backupFile);
  return backupFile;
}

function backupTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

module.exports = {
  getConfigDir,
  getConfigFile,
  ensureDir,
  readUserConfig,
  saveUserConfig,
  updateUserConfig,
  backupUserConfig,
  backupTimestamp,
};
