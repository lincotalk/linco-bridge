const { execFileSync } = require('child_process');

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

function safeUrlForDisplay(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return value || '未配置';
  }
}

module.exports = {
  commandExists,
  safeUrlForDisplay,
};
