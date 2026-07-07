const assert = require("assert");
const { sendAgentSession, sendTurnEnd } = require("../../src/core/protocol");
const { mapLocalEventToLinco } = require("../../src/channel/linco/protocol");

function createCaptureWs() {
  const sent = [];
  return {
    sent,
    send(raw) {
      sent.push(JSON.parse(raw));
    },
  };
}

{
  const ws = createCaptureWs();
  const session = {
    id: "session-1",
    agentType: "codex",
    agentSessionId: "codex-thread-1",
    linco: {
      messageId: "m-1",
      streamId: "linco-stream-m-1",
    },
  };

  sendAgentSession(ws, session);
  sendAgentSession(ws, session);

  assert.strictEqual(ws.sent.length, 1);
  assert.strictEqual(ws.sent[0].type, "agent_session");
  assert.strictEqual(ws.sent[0].requestId, "m-1");
  assert.strictEqual(ws.sent[0].streamId, "linco-stream-m-1");
  assert.strictEqual(ws.sent[0].sessionKey, "session-1");
  assert.strictEqual(ws.sent[0].agentType, "codex");
  assert.strictEqual(ws.sent[0].agentSessionId, "codex-thread-1");
  assert.strictEqual(ws.sent[0].session_id, "codex-thread-1");
  assert.strictEqual(ws.sent[0].established, true);
  assert.strictEqual(typeof ws.sent[0].ts, "number");
}

{
  const mapped = mapLocalEventToLinco(
    {
      type: "agent_session",
      requestId: "m-1",
      streamId: "linco-stream-m-1",
      sessionKey: "session-1",
      agentType: "claude",
      agentSessionId: "claude-session-1",
      session_id: "claude-session-1",
      ts: 123,
    },
    { id: "session-1", agentType: "claude", agentSessionId: "claude-session-1" },
    { im: { account: "main", agentId: "agent-1", channel: "linco" } },
    {
      messageId: "m-1",
      streamId: "linco-stream-m-1",
      chatType: "direct",
      userId: "u-1",
    },
  );

  assert.strictEqual(mapped.type, "agent_session");
  assert.strictEqual(mapped.requestId, "m-1");
  assert.strictEqual(mapped.streamId, "linco-stream-m-1");
  assert.strictEqual(mapped.sessionKey, "session-1");
  assert.strictEqual(mapped.agentType, "claude");
  assert.strictEqual(mapped.agentSessionId, "claude-session-1");
  assert.strictEqual(mapped.session_id, "claude-session-1");
  assert.strictEqual(mapped.established, true);
}

{
  const ws = createCaptureWs();
  const session = {
    id: "session-1",
    agentSessionId: "codex-thread-1",
    linco: {
      messageId: "m-1",
      streamId: "linco-stream-m-1",
    },
  };

  sendTurnEnd(ws, session);

  assert.strictEqual(ws.sent.length, 1);
  assert.strictEqual(ws.sent[0].type, "turn_end");
  assert.strictEqual(ws.sent[0].requestId, "m-1");
  assert.strictEqual(ws.sent[0].streamId, "linco-stream-m-1");
  assert.strictEqual(ws.sent[0].sessionKey, "session-1");
  assert.strictEqual(ws.sent[0].agentSessionId, "codex-thread-1");
  assert.strictEqual(ws.sent[0].session_id, "codex-thread-1");
  assert.strictEqual(ws.sent[0].reason, "completed");
  assert.strictEqual(typeof ws.sent[0].ts, "number");
}

{
  const ws = createCaptureWs();
  const session = {
    id: "session-1",
    linco: {
      messageId: "m-1",
      streamId: "linco-stream-m-1",
    },
  };

  sendTurnEnd(ws, session);
  sendTurnEnd(ws, session);

  assert.strictEqual(ws.sent.length, 1);
  assert.strictEqual(ws.sent[0].type, "turn_end");
}

{
  const ws = createCaptureWs();
  const session = {
    id: "session-1",
    linco: {
      messageId: "m-2",
      streamId: "linco-stream-m-2",
    },
  };

  sendTurnEnd(ws, session, "completed", {
    _linco: {
      messageId: "m-1",
      streamId: "linco-stream-m-1",
    },
  });

  assert.strictEqual(ws.sent.length, 1);
  assert.strictEqual(ws.sent[0].requestId, "m-1");
  assert.strictEqual(ws.sent[0].streamId, "linco-stream-m-1");
  assert.strictEqual(ws.sent[0]._linco, undefined);
}

{
  const ws = createCaptureWs();
  ws.linco = {
    messageId: "m-ws",
    streamId: "linco-stream-m-ws",
  };
  const session = {
    id: "session-1",
    linco: {
      messageId: "m-session",
      streamId: "linco-stream-m-session",
    },
  };

  sendTurnEnd(ws, session);

  assert.strictEqual(ws.sent.length, 1);
  assert.strictEqual(ws.sent[0].requestId, "m-ws");
  assert.strictEqual(ws.sent[0].streamId, "linco-stream-m-ws");
}

{
  const mapped = mapLocalEventToLinco(
    {
      type: "turn_end",
      requestId: "m-1",
      streamId: "linco-stream-m-1",
      sessionKey: "session-1",
      reason: "completed",
      ts: 123,
    },
    { id: "session-1", agentType: "claude" },
    { im: { account: "main", agentId: "agent-1", channel: "linco" } },
    {
      messageId: "m-1",
      streamId: "linco-stream-m-1",
      chatType: "direct",
      userId: "u-1",
    },
  );

  assert.strictEqual(mapped.type, "turn_end");
  assert.strictEqual(mapped.requestId, "m-1");
  assert.strictEqual(mapped.streamId, "linco-stream-m-1");
  assert.strictEqual(mapped.sessionKey, "session-1");
  assert.strictEqual(mapped.reason, "completed");
}

{
  const mapped = mapLocalEventToLinco(
    {
      type: "turn_end",
      requestId: "m-1",
      streamId: "linco-stream-m-1",
      sessionKey: "session-1",
      agentSessionId: "codex-thread-1",
      session_id: "codex-thread-1",
      reason: "completed",
      ts: 123,
    },
    { id: "session-1", agentType: "codex", agentSessionId: "codex-thread-1" },
    { im: { account: "main", agentId: "agent-1", channel: "linco" } },
    {
      messageId: "m-1",
      streamId: "linco-stream-m-1",
      chatType: "direct",
      userId: "u-1",
    },
  );

  assert.strictEqual(mapped.type, "turn_end");
  assert.strictEqual(mapped.agentSessionId, "codex-thread-1");
  assert.strictEqual(mapped.session_id, "codex-thread-1");
}

{
  const mapped = mapLocalEventToLinco(
    { type: "turn_start" },
    { id: "session-1", agentType: "claude" },
    { im: { account: "main", agentId: "agent-1", channel: "linco" } },
    {
      messageId: "m-1",
      streamId: "linco-stream-m-1",
      chatType: "direct",
      userId: "u-1",
    },
  );

  assert.strictEqual(mapped.type, "turn_start");
  assert.strictEqual(mapped.streamId, "linco-stream-m-1");
  assert.strictEqual(mapped.sessionKey, "session-1");
}

{
  const mapped = mapLocalEventToLinco(
    {
      type: "thinking",
      text: "Need to inspect the current implementation.",
      mode: "summary",
    },
    { id: "session-1", agentType: "hermes" },
    { im: { account: "main", agentId: "agent-1", channel: "linco" } },
    {
      messageId: "m-1",
      streamId: "linco-stream-m-1",
      chatType: "direct",
      userId: "u-1",
    },
  );

  assert.strictEqual(mapped.type, "thinking");
  assert.strictEqual(
    mapped.text,
    "Need to inspect the current implementation.",
  );
  assert.strictEqual(
    mapped.delta,
    "Need to inspect the current implementation.",
  );
  assert.strictEqual(
    mapped.fullText,
    "Need to inspect the current implementation.",
  );
  assert.strictEqual(mapped.mode, "summary");
  assert.strictEqual(mapped.streamId, "linco-stream-m-1");
  assert.strictEqual(mapped.done, false);
}

{
  const mapped = mapLocalEventToLinco(
    { type: "thinking_clear" },
    { id: "session-1", agentType: "hermes" },
    { im: { account: "main", agentId: "agent-1", channel: "linco" } },
    {
      messageId: "m-1",
      streamId: "linco-stream-m-1",
      chatType: "direct",
      userId: "u-1",
    },
  );

  assert.strictEqual(mapped.type, "thinking_clear");
  assert.strictEqual(mapped.streamId, "linco-stream-m-1");
  assert.strictEqual(mapped.done, true);
}

{
  const mapped = mapLocalEventToLinco(
    {
      type: "context_compaction",
      phase: "completed",
      compactionId: "cmp-1",
      agentType: "codex",
      agentSessionId: "thread-1",
      durationMs: 60612,
      text: "上下文整理完成，继续处理当前问题。",
      ts: 1780400928878,
    },
    { id: "session-1", agentType: "codex" },
    { im: { account: "main", agentId: "agent-1", channel: "linco" } },
    {
      messageId: "m-1",
      streamId: "linco-stream-m-1",
      chatType: "direct",
      userId: "u-1",
    },
  );

  assert.strictEqual(mapped.type, "context_compaction");
  assert.strictEqual(mapped.phase, "completed");
  assert.strictEqual(mapped.compactionId, "cmp-1");
  assert.strictEqual(mapped.agentType, "codex");
  assert.strictEqual(mapped.agentSessionId, "thread-1");
  assert.strictEqual(mapped.durationMs, 60612);
  assert.strictEqual(mapped.requestId, "m-1");
  assert.strictEqual(mapped.streamId, "linco-stream-m-1");
  assert.strictEqual(mapped.sessionKey, "session-1");
  assert.strictEqual(mapped.ts, 1780400928878);
}

{
  const linco = {
    messageId: "m-1",
    streamId: "linco-stream-m-1",
    chatType: "direct",
    userId: "u-1",
  };
  const mapped = mapLocalEventToLinco(
    {
      type: "agent_action",
      event: "started",
      action: {
        id: "bridge_thinking",
        type: "thinking",
        status: "running",
        label: "思考中",
        detail: "I need to inspect the workspace.",
        detail_kind: "markdown",
      },
    },
    { id: "session-1", agentType: "codex" },
    { im: { account: "main", agentId: "agent-1", channel: "linco" } },
    linco,
  );

  assert.strictEqual(mapped.type, "agent_action");
  assert.strictEqual(mapped.streamId, "linco-stream-m-1");
  assert.strictEqual(mapped.event, "started");
  assert.strictEqual(mapped.action.id, "bridge_thinking");
  assert.strictEqual(mapped.action.detail, "I need to inspect the workspace.");
  assert.strictEqual(typeof mapped.action.started_at, "number");
}

{
  const originalNow = Date.now;
  let now = 1710000000000;
  Date.now = () => now;
  try {
    const linco = {
      messageId: "m-1",
      streamId: "linco-stream-m-1",
      chatType: "direct",
      userId: "u-1",
    };
    const started = mapLocalEventToLinco(
      {
        type: "tool_call",
        id: "tool-1",
        name: "exec",
        input: "npm test",
      },
      { id: "session-1", agentType: "codex" },
      { im: { account: "main", agentId: "agent-1", channel: "linco" } },
      linco,
    );

    now = 1710000001200;
    const completed = mapLocalEventToLinco(
      {
        type: "tool_result",
        id: "tool-1",
        name: "exec",
        output: "ok",
      },
      { id: "session-1", agentType: "codex" },
      { im: { account: "main", agentId: "agent-1", channel: "linco" } },
      linco,
    );

    assert.strictEqual(started.type, "tool_call");
    assert.strictEqual(started.started_at, 1710000000000);
    assert.strictEqual(completed.type, "tool_result");
    assert.strictEqual(completed.started_at, 1710000000000);
    assert.strictEqual(completed.completed_at, 1710000001200);
    assert.strictEqual(completed.duration, 1200);
  } finally {
    Date.now = originalNow;
  }
}

{
  const linco = {
    messageId: "m-1",
    streamId: "linco-stream-m-1",
    chatType: "direct",
    userId: "u-1",
  };
  const first = mapLocalEventToLinco(
    { type: "thinking", text: "First step.", mode: "progress" },
    { id: "session-1", agentType: "hermes" },
    { im: { account: "main", agentId: "agent-1", channel: "linco" } },
    linco,
  );
  const second = mapLocalEventToLinco(
    { type: "thinking", text: "Second step.", mode: "progress" },
    { id: "session-1", agentType: "hermes" },
    { im: { account: "main", agentId: "agent-1", channel: "linco" } },
    linco,
  );

  assert.strictEqual(first.fullText, "First step.");
  assert.strictEqual(second.fullText, "Second step.");
}

console.log("linco turn_end contract ok");
