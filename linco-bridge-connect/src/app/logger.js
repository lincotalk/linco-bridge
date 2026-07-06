const fs = require('fs');
const path = require('path');

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function normalizeLevel(level) {
  const normalized = String(level || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, normalized) ? normalized : 'info';
}

function localTimestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}Z`;
}

function dateStamp(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayStamp() {
  return dateStamp();
}

function formatFields(fields) {
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(' ');
}

function formatValue(value) {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return JSON.stringify(text.replace(/[\r\n]+/g, ' '));
}

function createLogger(config = {}) {
  const configuredLevel = normalizeLevel(process.env.LOG_LEVEL || config.logLevel);
  const logsDir = config.logsDir;

  let currentLogDate = '';
  let currentLogFile = '';

  function shouldLog(level) {
    return LEVELS[level] >= LEVELS[configuredLevel];
  }

  function ensureLogsDir() {
    if (logsDir && !fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  function getLogFile() {
    const today = todayStamp();
    return path.join(logsDir, `linco-${today}.log`);
  }

  function rotateIfNeeded() {
    const nextFile = getLogFile();
    if (nextFile !== currentLogFile) {
      currentLogFile = nextFile;
      currentLogDate = todayStamp();
      cleanupOldLogs();
    }
  }

  function writeToFile(level, message, fields = {}) {
    if (!currentLogFile) return;
    const line = JSON.stringify({
      ts: localTimestamp(),
      level,
      msg: message,
      ...fields,
    }) + '\n';
    try {
      fs.appendFileSync(currentLogFile, line);
    } catch {
      // ignore write failures to avoid crashing the app
    }
  }

  function cleanupOldLogs(maxDays = 30) {
    if (!logsDir) return;
    try {
      const entries = fs.readdirSync(logsDir);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - maxDays);
      const cutoffStamp = dateStamp(cutoff);

      for (const entry of entries) {
        if (!entry.startsWith('linco-') || !entry.endsWith('.log')) continue;
        const fileDate = entry.slice(7, 17); // extract YYYY-MM-DD
        if (fileDate < cutoffStamp) {
          fs.unlinkSync(path.join(logsDir, entry));
        }
      }
    } catch {
      // ignore cleanup errors
    }
  }

  function write(level, message, fields = {}) {
    if (!shouldLog(level)) return;

    const timestamp = localTimestamp();
    const suffix = formatFields(fields);
    const line = `${timestamp} ${level.toUpperCase()} ${message}${suffix ? ` ${suffix}` : ''}`;

    if (logsDir) {
      ensureLogsDir();
      rotateIfNeeded();
      writeToFile(level, message, fields);
    }

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  };
}

module.exports = {
  createLogger,
};
