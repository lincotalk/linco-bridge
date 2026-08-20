# DeepSeek Harness Not Running Error Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return a clear `DeepSeek Harness 未启动，请先启动 Harness` error when DeepSeek requests reach a refused Harness endpoint, without changing bridge online status or other agents.

**Architecture:** Add one DeepSeek-local error normalizer that recursively recognizes Node.js `ECONNREFUSED` errors, including errors wrapped by `fetch` through `cause` or `AggregateError.errors`. Apply it to the shared HTTP fetch boundary and the Harness event WebSocket error boundary; retain all non-connection errors unchanged.

**Tech Stack:** Node.js 20+, CommonJS, built-in `fetch`, `ws`, `node:test`, `node:assert/strict`

---

## File Structure

- Modify `src/agent/deepseek/index.js`: define and apply DeepSeek Harness connection-error normalization.
- Modify `test/agent/deepseek-adapter.test.js`: reproduce a refused local Harness connection and protect non-connection errors and the existing successful Mock Harness path.

### Task 1: Reproduce the Harness-not-running Failure

**Files:**
- Modify: `test/agent/deepseek-adapter.test.js`
- Test: `test/agent/deepseek-adapter.test.js`

- [ ] **Step 1: Add a helper that returns a closed loopback URL**

Add this helper near the other test helpers:

```js
async function closedLoopbackUrl() {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  return `http://127.0.0.1:${port}`;
}
```

- [ ] **Step 2: Add the failing refused-connection test**

Add this test after the event URL mapping test:

```js
test('DeepSeek RPC reports when Harness is not running', async () => {
  const gatewayUrl = await closedLoopbackUrl();

  await assert.rejects(
    deepseek._internal.callRpc({ gatewayUrl }, 'workspace.list', {}),
    error => {
      assert.equal(error.code, 'DEEPSEEK_HARNESS_NOT_RUNNING');
      assert.equal(error.message, 'DeepSeek Harness 未启动，请先启动 Harness');
      return true;
    },
  );
});

test('DeepSeek turn returns the Harness-not-running message to the client', async t => {
  const gatewayUrl = await closedLoopbackUrl();
  const fixture = createFixture(gatewayUrl);
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));

  deepseek.execute('hello', fixture.ws, fixture.session, fixture.config);
  await waitFor(() => fixture.frames.some(frame => frame.type === 'turn_end'));

  assert.equal(
    fixture.frames.find(frame => frame.type === 'error')?.text,
    'DeepSeek Harness 未启动，请先启动 Harness',
  );
  assert.equal(fixture.frames.find(frame => frame.type === 'turn_end')?.reason, 'error');
});
```

- [ ] **Step 3: Run the focused test and verify the current behavior fails**

Run:

```powershell
node --test --test-name-pattern "Harness is not running" test/agent/deepseek-adapter.test.js
```

Expected: both matching tests `FAIL`; the current RPC rejection is `TypeError: fetch failed`, and the current client frame contains `DeepSeek Harness 错误: fetch failed`.

### Task 2: Normalize Refused Harness Connections

**Files:**
- Modify: `src/agent/deepseek/index.js:22`
- Modify: `src/agent/deepseek/index.js:166`
- Modify: `src/agent/deepseek/index.js:858`
- Test: `test/agent/deepseek-adapter.test.js`

- [ ] **Step 1: Add the error code, message, and recursive normalizer**

Place these definitions after `DEFAULT_GATEWAY_URL`:

```js
const HARNESS_NOT_RUNNING_CODE = 'DEEPSEEK_HARNESS_NOT_RUNNING';
const HARNESS_NOT_RUNNING_MESSAGE = 'DeepSeek Harness 未启动，请先启动 Harness';

function errorTreeHasCode(error, code, seen = new Set()) {
  if (!error || typeof error !== 'object' || seen.has(error)) return false;
  seen.add(error);
  if (error.code === code) return true;
  if (errorTreeHasCode(error.cause, code, seen)) return true;
  return Array.isArray(error.errors)
    && error.errors.some(item => errorTreeHasCode(item, code, seen));
}

function normalizeHarnessError(error) {
  if (error?.code === HARNESS_NOT_RUNNING_CODE) return error;
  const normalized = error instanceof Error ? error : new Error(String(error));
  if (!errorTreeHasCode(normalized, 'ECONNREFUSED')) return normalized;
  const unavailable = new Error(HARNESS_NOT_RUNNING_MESSAGE, { cause: normalized });
  unavailable.code = HARNESS_NOT_RUNNING_CODE;
  return unavailable;
}

function harnessErrorMessage(error, prefix) {
  const normalized = normalizeHarnessError(error);
  return normalized.code === HARNESS_NOT_RUNNING_CODE
    ? normalized.message
    : `${prefix}: ${normalized.message}`;
}
```

- [ ] **Step 2: Normalize HTTP transport errors once for all RPC and response requests**

Add this shared fetch wrapper before `callRpc`, then replace both direct `fetch` calls in `callRpc` and `respond` with `fetchHarness`:

```js
async function fetchHarness(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    throw normalizeHarnessError(error);
  }
}
```

The beginning of `callRpc` must become:

```js
async function callRpc(agentConfig, method, payload, signal) {
  const rpcId = crypto.randomUUID();
  const response = await fetchHarness(`${agentConfig.gatewayUrl}/api/${method}`, {
    method: 'POST',
    headers: buildHeaders(agentConfig, { 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
    ...(signal ? { signal } : {}),
  });
```

The beginning of `respond` must become:

```js
async function respond(agentConfig, rpcId, value) {
  const response = await fetchHarness(`${agentConfig.gatewayUrl}/api/respond`, {
    method: 'POST',
    headers: buildHeaders(agentConfig, { 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify({ type: 'client-response', rpcId, result: { ok: true, value } }),
  });
```

- [ ] **Step 3: Normalize event WebSocket startup failures**

Replace the event socket `onError` normalization with:

```js
const onError = (error) => {
  const normalized = normalizeHarnessError(error);
  if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) socket.terminate();
  if (controller.signal.aborted) settle();
  else settle(normalized);
};
```

In `runTurn`, avoid adding a second Harness prefix:

```js
const message = harnessErrorMessage(err, 'DeepSeek Harness 错误');
```

In the event stream task failure handler, use:

```js
const message = harnessErrorMessage(err, 'DeepSeek Harness 事件流中断');
sendError(ws, message);
sendTurnEnd(ws, session, 'error', { error: message });
```

- [ ] **Step 4: Export the normalizer for focused unit coverage**

Add these entries to the existing `_internal` export object:

```js
normalizeHarnessError,
HARNESS_NOT_RUNNING_CODE,
HARNESS_NOT_RUNNING_MESSAGE,
```

- [ ] **Step 5: Run the refused-connection test and verify it passes**

Run:

```powershell
node --test --test-name-pattern "Harness is not running" test/agent/deepseek-adapter.test.js
```

Expected: `PASS`; the rejected error has code `DEEPSEEK_HARNESS_NOT_RUNNING` and the approved message.

### Task 3: Protect Non-connection Errors and Existing Behavior

**Files:**
- Modify: `test/agent/deepseek-adapter.test.js`
- Test: `test/agent/deepseek-adapter.test.js`

- [ ] **Step 1: Add recursive-wrapper and pass-through tests**

Add these tests after the refused-connection test:

```js
test('DeepSeek Harness error normalization finds nested refused connections', () => {
  const refused = Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' });
  const wrapped = new TypeError('fetch failed', { cause: new AggregateError([refused]) });

  const normalized = deepseek._internal.normalizeHarnessError(wrapped);

  assert.equal(normalized.code, 'DEEPSEEK_HARNESS_NOT_RUNNING');
  assert.equal(normalized.message, 'DeepSeek Harness 未启动，请先启动 Harness');
});

test('DeepSeek Harness error normalization preserves unrelated errors', () => {
  const unauthorized = Object.assign(new Error('401 Unauthorized'), { code: 'EACCES' });

  assert.equal(deepseek._internal.normalizeHarnessError(unauthorized), unauthorized);
});
```

- [ ] **Step 2: Run the complete DeepSeek adapter tests**

Run:

```powershell
node --test test/agent/deepseek-adapter.test.js
```

Expected: all DeepSeek adapter tests pass, including existing message, project, history, settings, and Mock Harness success cases.

- [ ] **Step 3: Commit the focused implementation**

```powershell
git add src/agent/deepseek/index.js test/agent/deepseek-adapter.test.js
git commit -m "fix: report when DeepSeek Harness is not running"
```

### Task 4: Run Plugin Regression Tests

**Files:**
- Verify only; no source changes expected.

- [ ] **Step 1: Run the full plugin test suite**

Run:

```powershell
npm test
```

Expected: all plugin tests pass with zero failures.

- [ ] **Step 2: Verify the final diff is scoped**

Run:

```powershell
git status --short
git show --stat --oneline HEAD
```

Expected: the implementation commit contains only `src/agent/deepseek/index.js` and `test/agent/deepseek-adapter.test.js`; no service or Flutter files are changed.
