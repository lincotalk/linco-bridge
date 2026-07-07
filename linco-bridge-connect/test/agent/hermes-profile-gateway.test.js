const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ensureApiServerConfig,
  resolveHermesGatewayOptions,
  _internal,
} = require('../../src/gateway/hermesGateway');

{
  const hermesHome = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-hermes-default-profile-'));
  const options = resolveHermesGatewayOptions({
    profile: 'default',
    gatewayUrl: 'http://127.0.0.1:8642',
    hermesHome,
  });
  assert.strictEqual(options.gatewayUrl, 'http://127.0.0.1:8642');
  assert.strictEqual(options.port, 8642);
  assert.strictEqual(options.profile, 'default');
  assert.strictEqual(options.requestedProfile, 'default');
  assert.strictEqual(options.profileDir, hermesHome);
}

{
  const hermesHome = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-hermes-active-profile-'));
  fs.mkdirSync(path.join(hermesHome, 'profiles', 'writer'), { recursive: true });
  fs.writeFileSync(path.join(hermesHome, 'active_profile'), 'writer\n');
  const options = resolveHermesGatewayOptions({
    profile: 'default',
    gatewayUrl: 'http://127.0.0.1:8642',
    hermesHome,
  });
  const expectedPort = _internal.profileScopedPort(8642, 'writer');
  assert.strictEqual(options.requestedProfile, 'default');
  assert.strictEqual(options.profile, 'writer');
  assert.strictEqual(options.profileDir, path.join(hermesHome, 'profiles', 'writer'));
  assert.strictEqual(options.gatewayUrl, `http://127.0.0.1:${expectedPort}`);
  assert.strictEqual(options.port, expectedPort);
}

{
  const hermesHome = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-hermes-writer-profile-'));
  const options = resolveHermesGatewayOptions({
    profile: 'writer',
    gatewayUrl: 'http://127.0.0.1:8642',
    hermesHome,
  });
  const expectedPort = _internal.profileScopedPort(8642, 'writer');
  assert.strictEqual(options.gatewayUrl, `http://127.0.0.1:${expectedPort}`);
  assert.strictEqual(options.port, expectedPort);
  assert.strictEqual(options.profileDir, path.join(hermesHome, 'profiles', 'writer'));
}

{
  const hermesHome = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-hermes-unscoped-profile-'));
  const options = resolveHermesGatewayOptions({
    profile: 'writer',
    profileScopedGateway: false,
    gatewayUrl: 'http://127.0.0.1:8642',
    hermesHome,
  });
  assert.strictEqual(options.gatewayUrl, 'http://127.0.0.1:8642');
  assert.strictEqual(options.port, 8642);
}

{
  const hermesHome = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-hermes-profile-home-'));
  const profileHome = path.join(hermesHome, 'profiles', 'writer');
  fs.mkdirSync(profileHome, { recursive: true });
  fs.writeFileSync(path.join(hermesHome, 'active_profile'), 'other\n');
  const options = resolveHermesGatewayOptions({
    profile: 'default',
    gatewayUrl: 'http://127.0.0.1:8642',
    hermesHome: profileHome,
  });
  assert.strictEqual(options.profile, 'writer');
  assert.strictEqual(options.profileDir, profileHome);
}

{
  const hermesHome = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-hermes-api-env-'));
  const apiKey = ensureApiServerConfig({
    profileDir: hermesHome,
    host: '127.0.0.1',
    port: 8642,
    apiKey: 'test-api-key',
  });
  const env = _internal.buildGatewayEnv({
    baseEnv: { PATH: 'test-path' },
    profileDir: hermesHome,
    host: '127.0.0.1',
    port: 8642,
    apiKey,
  });
  const cfg = require('yaml').parse(fs.readFileSync(path.join(hermesHome, 'config.yaml'), 'utf8'));
  assert.strictEqual(cfg.platforms.api_server.key, 'test-api-key');
  assert.strictEqual(cfg.platforms.api_server.extra.key, 'test-api-key');
  assert.strictEqual(env.HERMES_HOME, hermesHome);
  assert.strictEqual(env.API_SERVER_ENABLED, 'true');
  assert.strictEqual(env.API_SERVER_KEY, 'test-api-key');
  assert.strictEqual(env.API_SERVER_HOST, '127.0.0.1');
  assert.strictEqual(env.API_SERVER_PORT, '8642');
  assert.strictEqual(env.PATH, 'test-path');
}

{
  const hermesHome = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-hermes-health-key-'));
  ensureApiServerConfig({
    profileDir: hermesHome,
    host: '127.0.0.1',
    port: 8642,
    apiKey: 'existing-health-key',
  });
  const agentConfig = { hermesHome };
  _internal.applyHermesApiKeyFromProfile(agentConfig, hermesHome);
  assert.strictEqual(agentConfig.apiKey, 'existing-health-key');
}

{
  assert.strictEqual(
    _internal.shouldUseProfileScopedGateway(
      { profileScopedGateway: true },
      'writer',
      'https://example.com:8642',
      true
    ),
    false
  );
}

console.log('hermes profile gateway ok');
