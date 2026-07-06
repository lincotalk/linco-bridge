const os = require('os');
const path = require('path');

const TIMEOUT = 10 * 60 * 1000;
const DEFAULT_IM_IDLE_SESSION_MS = 4 * 60 * 60 * 1000;
const CONFIG_DIR = path.join(os.homedir(), '.linco');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_UNSAFE_ATTACHMENT_EXTENSIONS = [
  '.exe',
  '.msi',
  '.dll',
  '.com',
  '.scr',
  '.bat',
  '.cmd',
  '.ps1',
  '.vbs',
  '.hta',
  '.lnk',
  '.url',
  '.reg',
  '.cpl',
];

module.exports = {
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_IM_IDLE_SESSION_MS,
  DEFAULT_UNSAFE_ATTACHMENT_EXTENSIONS,
  TIMEOUT,
};
