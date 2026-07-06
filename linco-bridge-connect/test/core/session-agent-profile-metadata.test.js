const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSession, saveSessionMetadata } = require('../../src/core/session');

{
  const lincoHome = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-session-openclaw-'));
  const config = { lincoHome, sessionsDir: path.join(lincoHome, 'legacy'), attachmentsDirName: 'attachments' };
  const session = createSession(config, { externalSessionId: 'oc-session', agentType: 'openclaw' });
  session.openclawAgentId = 'backend-engineer';
  saveSessionMetadata(session);

  const restored = createSession(config, { externalSessionId: 'oc-session', agentType: 'openclaw' });
  assert.strictEqual(restored.openclawAgentId, 'backend-engineer');
  assert.strictEqual(restored.hermesProfile, null);
}

{
  const lincoHome = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-session-approve-'));
  const config = { lincoHome, sessionsDir: path.join(lincoHome, 'legacy'), attachmentsDirName: 'attachments' };
  const session = createSession(config, { externalSessionId: 'approve-session', agentType: 'codex' });
  assert.strictEqual(session.approveMode, 'auto');
  assert.strictEqual(session.autoApprove, true);
  session.approveMode = 'yolo';
  session.autoApprove = true;
  saveSessionMetadata(session);

  const restored = createSession(config, { externalSessionId: 'approve-session', agentType: 'codex' });
  assert.strictEqual(restored.approveMode, 'yolo');
  assert.strictEqual(restored.autoApprove, true);
}

{
  const lincoHome = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-session-hermes-'));
  const config = { lincoHome, sessionsDir: path.join(lincoHome, 'legacy'), attachmentsDirName: 'attachments' };
  const session = createSession(config, { externalSessionId: 'hermes-session', agentType: 'hermes' });
  session.hermesProfile = 'work';
  saveSessionMetadata(session);

  const restored = createSession(config, { externalSessionId: 'hermes-session', agentType: 'hermes' });
  assert.strictEqual(restored.hermesProfile, 'work');
  assert.strictEqual(restored.openclawAgentId, null);
}

console.log('session agent/profile metadata ok');
