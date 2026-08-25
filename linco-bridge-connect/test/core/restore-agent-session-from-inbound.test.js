'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('path');
const test = require('node:test');

const {
  createSession,
  restoreAgentSessionIdFromInbound,
  saveSessionMetadata,
  stopAgentProcess,
} = require('../../src/core/session');

function makeTempConfig() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-restore-session-'));
  return {
    sessionsDir: tmp,
    attachmentsDirName: 'attachments',
    lincoHome: tmp,
  };
}

test('inbound expectedAgentSessionId restores empty agentSessionId after stop', () => {
  const config = makeTempConfig();
  const session = createSession(config, {
    externalSessionId: 'agent:codex:linco:direct:conv_temp_weather',
    externalSessionScope: 'linco:default',
    agentType: 'codex',
  });
  session.agentSessionId = '019ef8e5-1111-7222-8333-abcdef123456';
  saveSessionMetadata(session);

  stopAgentProcess(session, { clearAgentSession: false });
  // 模拟闲置回收后元数据丢失 / 落到错误 storage，内存会话被重建为空绑定
  session.agentSessionId = null;

  const restored = restoreAgentSessionIdFromInbound(session, {
    expectedAgentSessionId: '019ef8e5-1111-7222-8333-abcdef123456',
    userId: '019ef8e5-1111-7222-8333-abcdef123456',
  });

  assert.equal(restored, true);
  assert.equal(session.agentSessionId, '019ef8e5-1111-7222-8333-abcdef123456');
});

test('inbound restore ignores conv_ and human user fallback ids', () => {
  const config = makeTempConfig();
  const session = createSession(config, {
    externalSessionId: 'agent:codex:linco:direct:conv_temp_weather',
    agentType: 'codex',
  });

  assert.equal(
    restoreAgentSessionIdFromInbound(session, {
      expectedAgentSessionId: 'conv_temp_weather',
    }),
    false,
  );
  assert.equal(session.agentSessionId, null);

  assert.equal(
    restoreAgentSessionIdFromInbound(session, {
      userId: 'alice-user-uuid-should-not-bind',
    }),
    false,
  );
  assert.equal(session.agentSessionId, null);
});

test('/stop keeps agentSessionId persisted for the next recreate', () => {
  const config = makeTempConfig();
  const session = createSession(config, {
    externalSessionId: 'agent:codex:linco:direct:conv_temp_weather',
    externalSessionScope: 'linco:default',
    agentType: 'codex',
  });
  session.agentSessionId = '019ef8e5-aaaa-bbbb-cccc-ddddeeeeffff';
  saveSessionMetadata(session);
  stopAgentProcess(session, { clearAgentSession: false });
  // /stop 后应显式落盘，避免仅有内存 id
  saveSessionMetadata(session);

  const reloaded = createSession(config, {
    externalSessionId: 'agent:codex:linco:direct:conv_temp_weather',
    externalSessionScope: 'linco:default',
    agentType: 'codex',
  });
  assert.equal(reloaded.agentSessionId, '019ef8e5-aaaa-bbbb-cccc-ddddeeeeffff');
});
