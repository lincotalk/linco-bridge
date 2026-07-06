const assert = require('assert');
const { _internal } = require('../../src/agents/openclaw');
const { _internal: imInternal } = require('../../src/channels/bridge/connector');
const { OpenClawGatewayClient } = require('../../src/gateways/openclawGateway');

{
  const agentId = _internal.resolveOpenClawAgentId(
    {
      _lincoMeta: {
        agentId: '69bb1690145e40c6af3c9823a7d0a719',
      },
    },
    {},
    { openclawAgentId: 'main' },
  );

  assert.strictEqual(agentId, 'main');
}

{
  const agentId = _internal.resolveOpenClawAgentId(
    [],
    { openclawAgentId: 'qa-engineer' },
    { openclawAgentId: 'main' },
  );

  assert.strictEqual(agentId, 'qa-engineer');
}

{
  const agentId = _internal.resolveOpenClawAgentId(
    {
      _lincoMeta: {
        agentId: 'bridge-agent',
      },
    },
    { openclawAgentId: 'qa-engineer' },
    { openclawAgentId: 'main' },
  );

  assert.strictEqual(agentId, 'qa-engineer');
}

{
  const agentId = _internal.resolveOpenClawAgentId(
    {
      _lincoMeta: {
        agentId: 'bridge-agent',
        openclawAgentId: 'backend-engineer',
      },
    },
    { openclawAgentId: 'qa-engineer' },
    { openclawAgentId: 'main' },
  );

  assert.strictEqual(agentId, 'qa-engineer');
}

{
  const session = {};
  const agentId = _internal.resolveOpenClawAgentId(
    {
      _lincoMeta: {
        agentId: 'bridge-agent',
        openclawAgentId: 'backend-engineer',
      },
    },
    session,
    { openclawAgentId: 'main' },
  );

  assert.strictEqual(agentId, 'backend-engineer');
  assert.strictEqual(session.openclawAgentId, 'backend-engineer');
}

{
  const agentId = imInternal.resolveOpenClawAgentIdFromMessage(
    { agentId: '69bb1690145e40c6af3c9823a7d0a719' },
    {},
    { openclawAgentId: 'main' },
    { agents: { openclaw: { openclawAgentId: 'main' } } },
  );

  assert.strictEqual(agentId, 'main');
}

{
  const agentId = imInternal.resolveOpenClawAgentIdFromMessage(
    {
      agentId: 'bridge-agent',
      openclawAgentId: 'qa-engineer',
    },
    { openclawAgentId: 'backend-engineer' },
    { openclawAgentId: 'main' },
    { agents: { openclaw: { openclawAgentId: 'main' } } },
  );

  assert.strictEqual(agentId, 'backend-engineer');
}

{
  const agentId = imInternal.resolveOpenClawAgentIdFromMessage(
    {
      agentId: 'bridge-agent',
      openclawAgentId: 'qa-engineer',
    },
    {},
    { openclawAgentId: 'main' },
    { agents: { openclaw: { openclawAgentId: 'main' } } },
  );

  assert.strictEqual(agentId, 'qa-engineer');
}

{
  const sessionKey = _internal.buildOpenClawSessionKey('main', {
    storageId: 'sid_abcdef123456',
  });

  assert.strictEqual(sessionKey, 'agent:main:linco:direct:sid_abcdef123456');
}

{
  const sessionKey = _internal.buildOpenClawSessionKey('Backend Engineer', {
    storageId: 'sid_abcdef123456',
    linco: { chatType: 'group-chat' },
  });

  assert.strictEqual(sessionKey, 'agent:backend-engineer:linco:group-chat:sid_abcdef123456');
}

{
  assert.strictEqual(
    _internal.isSessionKeyForAgent('agent:main:linco:direct:sid_abcdef123456', 'main'),
    true,
  );
  assert.strictEqual(
    _internal.isSessionKeyForAgent('agent:main:ddchat:sid_abcdef123456', 'main'),
    false,
  );
}

{
  const input = '联网搜索一张可爱的小猫的图片发给我\n\n系统提示：用户正在要求发送或获取文件/图片。请将最终文件保存到当前工作目录或会话运行目录，并在回复中返回文件路径引用；用户点击引用后会自动触发 /get <路径> 下发文件。\n当前工作目录: C:/tmp/workspace';
  const labelA = _internal.buildOpenClawSessionLabel(input, { id: 'session-1' });
  const labelB = _internal.buildOpenClawSessionLabel(input, { id: 'session-1' });

  assert(labelA.startsWith('联网搜索一张可爱的小猫的图片发给我 #'));
  assert(!labelA.includes('系统提示'));
  assert.notStrictEqual(labelA, labelB);
  assert.strictEqual(
    _internal.sanitizeOpenClawErrorMessage(`label already in use: ${input}`),
    'label already in use: 联网搜索一张可爱的小猫的图片发给我',
  );
}

{
  const sent = [];
  const ws = {
    send(raw) {
      sent.push(JSON.parse(raw));
    },
  };
  const session = {
    id: 'session-1',
    isTurnActive: true,
    openclawRunId: 'run-1',
    messageQueue: [],
    pendingPermissions: new Map(),
    streamState: {},
  };

  _internal.handleOpenClawGatewayClose(new Error('closed'), ws, session, {});

  assert.strictEqual(session.isTurnActive, false);
  assert.strictEqual(session.openclawRunId, null);
  assert(sent.some(msg => msg.type === 'error' && msg.text.includes('Gateway disconnected')));
  assert(sent.some(msg => msg.type === 'turn_end' && msg.reason === 'error'));
}

{
  const client = new OpenClawGatewayClient({ url: 'ws://127.0.0.1:18789' });
  let calls = 0;
  client.onClose(() => {
    calls += 1;
  });

  client.notifyClose(new Error('first'));
  client.notifyClose(new Error('second'));

  assert.strictEqual(calls, 1);
  client.close();
}

console.log('openclaw agent id resolution ok');
