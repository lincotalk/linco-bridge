const { execFileSync } = require('child_process');

const CLAUDE_ENV_KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION',
  'ANTHROPIC_DEFAULT_OPUS_MODEL_NAME',
  'ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION',
  'ANTHROPIC_DEFAULT_SONNET_MODEL_NAME',
  'ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_SMALL_FAST_MODEL',
  'ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDE_CODE_SUBAGENT_MODEL',
  'CLAUDE_CODE_SKIP_BEDROCK_AUTH',
  'CLAUDE_CODE_SKIP_VERTEX_AUTH',
  'CLAUDE_CODE_SKIP_FOUNDRY_AUTH',
  'AWS_BEARER_TOKEN_BEDROCK',
  'ANTHROPIC_BEDROCK_BASE_URL',
  'ANTHROPIC_VERTEX_BASE_URL',
  'ANTHROPIC_VERTEX_PROJECT_ID',
  'ANTHROPIC_FOUNDRY_BASE_URL',
  'ANTHROPIC_FOUNDRY_RESOURCE',
  'ANTHROPIC_FOUNDRY_API_KEY',
  'CLOUD_ML_REGION',
  'DISABLE_TELEMETRY',
  'DISABLE_COST_WARNINGS',
  'NO_PROXY',
];

const CODEX_ENV_KEYS = [
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_ORG_ID',
  'OPENAI_PROJECT_ID',
  'CODEX_HOME',
];

function buildAgentEnv(agentType, baseEnv = process.env, options = {}) {
  const env = { ...baseEnv };
  const keys = agentEnvKeys(agentType);
  fillMissingSystemEnv(env, keys, options);
  return env;
}

function buildClaudeEnv(baseEnv = process.env, options = {}) {
  const env = buildAgentEnv('claude', baseEnv, options);
  delete env.CLAUDECODE;
  return env;
}

function buildCodexEnv(baseEnv = process.env, options = {}) {
  return buildAgentEnv('codex', baseEnv, options);
}

function agentEnvKeys(agentType) {
  if (agentType === 'claude') return CLAUDE_ENV_KEYS;
  if (agentType === 'codex') return CODEX_ENV_KEYS;
  return [];
}

function fillMissingSystemEnv(env, keys, options = {}) {
  const missing = keys.filter(key => !hasValue(env[key]));
  if (missing.length === 0) return;

  if (!options.readSystemEnv && process.platform === 'win32') {
    const userEnv = readWindowsSystemEnvMap(missing, 'User');
    const stillMissing = [];
    for (const key of missing) {
      if (hasValue(userEnv[key])) env[key] = userEnv[key];
      else stillMissing.push(key);
    }
    if (stillMissing.length === 0) return;

    const machineEnv = readWindowsSystemEnvMap(stillMissing, 'Machine');
    for (const key of stillMissing) {
      if (hasValue(machineEnv[key])) env[key] = machineEnv[key];
    }
    return;
  }

  for (const key of keys) {
    if (hasValue(env[key])) continue;
    const value = readSystemEnv(key, options);
    if (hasValue(value)) env[key] = value;
  }
}

function readSystemEnv(name, options = {}) {
  const reader = options.readSystemEnv || defaultReadSystemEnv;
  const userValue = reader(name, 'User');
  if (hasValue(userValue)) return userValue;
  return reader(name, 'Machine');
}

function defaultReadSystemEnv(name, target) {
  if (process.platform !== 'win32') return '';
  try {
    return execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `[Environment]::GetEnvironmentVariable(${quotePowerShellString(name)}, ${quotePowerShellString(target)})`,
    ], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      timeout: 2000,
    }).trim();
  } catch {
    return '';
  }
}

function readWindowsSystemEnvMap(names, target) {
  if (!names.length) return {};
  try {
    const raw = execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      buildWindowsEnvMapCommand(names, target),
    ], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      timeout: 2000,
    }).trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function buildWindowsEnvMapCommand(names, target) {
  const nameList = names.map(quotePowerShellString).join(', ');
  return [
    `$names = @(${nameList})`,
    `$target = ${quotePowerShellString(target)}`,
    '$result = @{}',
    'foreach ($name in $names) {',
    '  $value = [Environment]::GetEnvironmentVariable($name, $target)',
    "  if ($null -ne $value -and $value -ne '') { $result[$name] = $value }",
    '}',
    '$result | ConvertTo-Json -Compress',
  ].join('; ');
}

function hasValue(value) {
  return value != null && String(value) !== '';
}

function quotePowerShellString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

module.exports = {
  CLAUDE_ENV_KEYS,
  CODEX_ENV_KEYS,
  buildAgentEnv,
  buildClaudeEnv,
  buildCodexEnv,
  _internal: {
    buildWindowsEnvMapCommand,
    fillMissingSystemEnv,
    quotePowerShellString,
    readWindowsSystemEnvMap,
    readSystemEnv,
  },
};
