const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { _internal } = require('../../../src/channels/bridge/connector');
const { _internal: wsServerInternals } = require('../../../src/app/wsServer');

function createConnector() {
  const sent = [];
  return {
    sent,
    config: {
      im: {
        account: 'main',
        agentId: 'agent-1',
        channel: 'linco',
      },
    },
    sendLincoMessage(payload) {
      sent.push(payload);
    },
  };
}

function inbound(messageId) {
  return {
    type: 'inbound_message',
    accountId: 'main',
    agentId: 'agent-1',
    sessionKey: 'remote-session-1',
    messageId,
    streamId: `stream-${messageId}`,
    text: `message ${messageId}`,
  };
}

{
  assert.deepStrictEqual(_internal.remoteInboundMetaForLog({
    type: 'inbound_message',
    accountId: 'main',
    agentId: 'agent-1',
    sessionKey: 'remote-session-1',
    messageId: 'm-log',
    text: 'hello',
    files: [{ name: 'a.txt' }],
  }), {
    type: 'inbound_message',
    messageId: 'm-log',
    streamId: 'linco-stream-m-log',
    sessionKey: 'remote-session-1',
    accountId: 'main',
    agentId: 'agent-1',
    textLength: 5,
    attachmentCount: 1,
  });
}

{
  assert.deepStrictEqual(_internal.remoteTurnEndMetaForLog({
    type: 'turn_end',
    requestId: 'm-1',
    messageId: 'm-1',
    streamId: 'stream-m-1',
    sessionKey: 'remote-session-1',
    accountId: 'main',
    agentId: 'agent-1',
    channel: 'linco',
    reason: 'completed',
    fullText: 'not logged',
  }), {
    type: 'turn_end',
    requestId: 'm-1',
    messageId: 'm-1',
    streamId: 'stream-m-1',
    sessionKey: 'remote-session-1',
    accountId: 'main',
    agentId: 'agent-1',
    channel: 'linco',
    reason: 'completed',
  });
}

{
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-im-account-selector-'));
  const configFile = path.join(configDir, 'config.json');
  fs.writeFileSync(configFile, `${JSON.stringify({
    defaultChannel: 'linco',
    channels: {
      linco: {
        agents: {
          openclaw: {
            defaultAccount: 'main',
            accounts: {
              main: { openclawAgentId: 'main' },
              qa: { openclawAgentId: 'qa-agent' },
            },
          },
          hermes: {
            defaultAccount: 'main',
            accounts: {
              main: { profile: 'default' },
              writer: { profile: 'writer-profile' },
            },
          },
        },
      },
    },
  }, null, 2)}\n`);

  assert.strictEqual(_internal.resolveOpenClawAgentIdFromMessage(
    { accountId: 'qa', channel: 'linco' },
    {},
    { openclawAgentId: 'main' },
    { configFile, im: { account: 'main', channel: 'linco' }, agents: { openclaw: { openclawAgentId: 'main' } } },
  ), 'qa-agent');

  assert.strictEqual(_internal.resolveHermesProfileFromMessage(
    { accountId: 'writer', channel: 'linco' },
    {},
    { profile: 'default' },
    { configFile, im: { account: 'main', channel: 'linco' }, agents: { hermes: { profile: 'default' } } },
  ), 'writer-profile');

  const openclawSession = {
    agentType: 'openclaw',
    linco: { accountId: 'qa', channel: 'linco' },
  };
  wsServerInternals.freezeLocalLincoSelector(
    { accountId: 'qa', channel: 'linco' },
    openclawSession,
    { configFile, agents: { openclaw: { openclawAgentId: 'main' } } },
  );
  assert.strictEqual(openclawSession.openclawAgentId, 'qa-agent');

  const hermesSession = {
    agentType: 'hermes',
    linco: { accountId: 'writer', channel: 'linco' },
  };
  wsServerInternals.freezeLocalLincoSelector(
    { accountId: 'writer', channel: 'linco' },
    hermesSession,
    { configFile, agents: { hermes: { profile: 'default' } } },
  );
  assert.strictEqual(hermesSession.hermesProfile, 'writer-profile');
}

{
  const connector = createConnector();
  const session = {
    id: 'remote-session-1',
    agentType: 'codex',
  };

  const firstMeta = _internal.lincoMetaFromMessage(inbound('m-1'));
  session.linco = firstMeta;
  const firstWs = _internal.createRemoteAdapter(connector, session, firstMeta);

  const secondMeta = _internal.lincoMetaFromMessage(inbound('m-2'));
  session.linco = secondMeta;
  const secondWs = _internal.createRemoteAdapter(connector, session, secondMeta);

  firstWs.send(JSON.stringify({ type: 'turn_end', reason: 'completed' }));
  secondWs.send(JSON.stringify({ type: 'turn_end', reason: 'completed' }));

  assert.deepStrictEqual(connector.sent.map(item => ({
    type: item.type,
    requestId: item.requestId,
    streamId: item.streamId,
    sessionKey: item.sessionKey,
  })), [
    {
      type: 'turn_end',
      requestId: 'm-1',
      streamId: 'stream-m-1',
      sessionKey: 'remote-session-1',
    },
    {
      type: 'turn_end',
      requestId: 'm-2',
      streamId: 'stream-m-2',
      sessionKey: 'remote-session-1',
    },
  ]);
}

console.log('remote im turn binding ok');
