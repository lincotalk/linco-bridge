const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isSourceCheckout } = require('../app/selfUpdate')._internal;

const DEVICE_FILE = 'device.json';

function getDeviceIdentity(config = {}) {
  const configuredId = stringOrEmpty(process.env.LINCO_DEVICE_ID || config.device?.id);
  const configuredName = stringOrEmpty(process.env.LINCO_DEVICE_NAME || config.device?.name);
  const stored = configuredId ? {} : readStoredDevice(config);
  const id = configuredId || stored.id || createAndStoreDeviceId(config);

  return {
    id,
    name: configuredName || stored.name || os.hostname(),
    platform: process.platform,
    arch: process.arch,
  };
}

function getClientInfo() {
  const pkg = readPackageJson();
  const rootDir = path.resolve(__dirname, '..', '..');
  const sourceCheckout = isSourceCheckout(rootDir);
  const sourceSelfUpdateAllowed =
    process.env.LINCO_ALLOW_SOURCE_SELF_UPDATE === '1';
  return {
    name: pkg.name || 'linco-connect',
    version: pkg.version || '',
    installType: sourceCheckout ? 'source' : 'npm',
    selfUpdateSupported: !sourceCheckout || sourceSelfUpdateAllowed,
  };
}

function readStoredDevice(config = {}) {
  try {
    const file = deviceFilePath(config);
    if (!file || !fs.existsSync(file)) return {};
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      id: stringOrEmpty(parsed.id),
      name: stringOrEmpty(parsed.name),
    };
  } catch {
    return {};
  }
}

function createAndStoreDeviceId(config = {}) {
  const id = `linco-${crypto.randomUUID()}`;
  try {
    const file = deviceFilePath(config);
    if (!file) return id;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
      id,
      name: os.hostname(),
      createdAt: new Date().toISOString(),
    }, null, 2));
  } catch {}
  return id;
}

function deviceFilePath(config = {}) {
  const home = stringOrEmpty(config.lincoHome);
  if (!home) return '';
  return path.join(home, DEVICE_FILE);
}

function readPackageJson() {
  try {
    return require('../../package.json');
  } catch {
    return {};
  }
}

function stringOrEmpty(value) {
  return String(value || '').trim();
}

module.exports = {
  getClientInfo,
  getDeviceIdentity,
};
