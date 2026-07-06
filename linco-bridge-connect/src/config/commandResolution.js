const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function pathCandidatesFromEnv() {
  return (process.env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap(dir => [
      path.join(dir, 'bash.exe'),
      path.join(dir, '..', 'bin', 'bash.exe'),
      path.join(dir, '..', 'usr', 'bin', 'bash.exe'),
    ]);
}

function pathCandidatesFromWhere(command) {
  try {
    return execFileSync('where.exe', [command], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    })
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function resolveCommand(command) {
  if (!command) return command;
  if (path.isAbsolute(command) && fs.existsSync(command)) return command;
  if (process.platform !== 'win32') return command;

  const ext = path.extname(command);
  // On Windows, prefer executable shim variants first; npm installs
  // produce .cmd files that handle spawning Node CLI packages.
  const names = ext
    ? [command]
    : [`${command}.cmd`, `${command}.exe`, `${command}.bat`, command];
  for (const name of names) {
    for (const candidate of pathCandidatesFromWhere(name)) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return command;
}

function gitBashCandidates() {
  const programFiles = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
  const localAppData = process.env.LOCALAPPDATA;
  const candidates = [
    ...programFiles.flatMap(dir => [
      path.join(dir, 'Git', 'bin', 'bash.exe'),
      path.join(dir, 'Git', 'usr', 'bin', 'bash.exe'),
    ]),
    localAppData && path.join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe'),
    localAppData && path.join(localAppData, 'Programs', 'Git', 'usr', 'bin', 'bash.exe'),
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    'D:\\Program Files\\Git\\bin\\bash.exe',
    'D:\\Program Files\\Git\\usr\\bin\\bash.exe',
    ...pathCandidatesFromEnv(),
    ...pathCandidatesFromWhere('bash.exe'),
    ...pathCandidatesFromWhere('git-bash.exe')
      .flatMap(file => [
        path.join(path.dirname(file), '..', 'bin', 'bash.exe'),
        path.join(path.dirname(file), '..', 'usr', 'bin', 'bash.exe'),
      ]),
    ...pathCandidatesFromWhere('git.exe')
      .flatMap(file => [
        path.join(path.dirname(file), 'bash.exe'),
        path.join(path.dirname(file), '..', 'bin', 'bash.exe'),
        path.join(path.dirname(file), '..', 'usr', 'bin', 'bash.exe'),
      ]),
  ];

  return [...new Set(candidates.filter(Boolean).map(candidate => path.normalize(candidate)))];
}

function findGitBash(userConfig = {}) {
  if (process.platform !== 'win32') return null;

  if (process.env.CLAUDE_CODE_GIT_BASH_PATH) {
    return process.env.CLAUDE_CODE_GIT_BASH_PATH;
  }

  if (userConfig.gitBashPath) {
    return userConfig.gitBashPath;
  }

  for (const candidate of gitBashCandidates()) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

module.exports = {
  findGitBash,
  resolveCommand,
};
