# Codex Visible Project Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make Codex `/sessions` list only user-visible project conversations while keeping Claude collection and explicit Codex session lookup compatible.

**Architecture:** Add one source-classification helper in the history reader layer and reuse it from the SQLite and JSONL session collectors. SQLite builds a schema-aware visibility predicate before `LIMIT`; JSONL reads `session_meta.payload.source` and filters after metadata parsing.

**Tech Stack:** Node.js, CommonJS, `node:test`, `better-sqlite3`, JSONL session metadata.

## Global Constraints

- Exclude Codex Subagent threads from project session listings only.
- Apply SQLite filtering before `LIMIT`.
- Preserve explicit lookup and binding by a known Codex session ID.
- Preserve behavior on older SQLite schemas without source-classification columns.
- Do not change Claude production behavior.
- Follow RED-GREEN-REFACTOR for every production change.

---

### Task 1: Codex Source Classification And JSONL Filtering

**Files:**
- Modify: `src/command/history/readers.js`
- Modify: `src/command/history/sessions.js`
- Create: `test/command/codex-visible-project-sessions.test.js`

**Interfaces:**
- Produces: `isCodexSubagentSource(threadSource, source): boolean` exported from `readers.js`.
- Changes: `readCodexSessionMeta(filePath)` adds a `source` field without changing existing `id`, `cwd`, or `firstMessage` fields.
- Consumes: `collectCodexProjectSessions(homeDir, workspace, options)` remains the public listing API.

- [x] **Step 1: Write the failing JSONL and Claude compatibility tests**

Create a focused `node:test` file that:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  collectClaudeProjectSessions,
  collectCodexProjectSessions,
} = require('../../src/command/history/sessions');

test('Codex JSONL listing excludes Subagent sessions', () => {
  // Write one main session_meta with source: 'vscode' and one newer session_meta
  // with source: { subagent: { thread_spawn: { parent_thread_id: 'parent' } } }.
  // Assert only the main session ID is returned.
});

test('Claude top-level project session listing remains unchanged', () => {
  // Write two top-level Claude JSONL files in the encoded project directory.
  // Assert both session IDs remain visible.
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test test/command/codex-visible-project-sessions.test.js
```

Expected: the Codex JSONL test fails because the Subagent session is still returned; the Claude compatibility test passes.

- [x] **Step 3: Implement source classification and JSONL filtering**

In `readers.js`:

```js
function isCodexSubagentSource(threadSource, source) {
  if (stringOrEmpty(threadSource).trim().toLowerCase() === 'subagent') return true;
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    return Object.prototype.hasOwnProperty.call(source, 'subagent');
  }
  const text = stringOrEmpty(source).trim();
  if (!text) return false;
  try {
    const parsed = JSON.parse(text);
    return !!parsed && typeof parsed === 'object' &&
      Object.prototype.hasOwnProperty.call(parsed, 'subagent');
  } catch {
    return false;
  }
}
```

Extend `readCodexSessionMeta` to retain `item.payload.source` from `session_meta`. Export the classifier. In the JSONL loop in `collectCodexProjectSessions`, skip metadata for which `isCodexSubagentSource('', meta.source)` is true before workspace matching and result limiting.

- [x] **Step 4: Re-run the focused test and verify GREEN**

Run:

```bash
node --test test/command/codex-visible-project-sessions.test.js
```

Expected: both tests pass.

- [x] **Step 5: Commit the JSONL filtering task**

```bash
git add src/command/history/readers.js src/command/history/sessions.js test/command/codex-visible-project-sessions.test.js
git commit -m "fix: hide Codex subagent project sessions"
```

### Task 2: SQLite Pre-Limit Filtering And Schema Compatibility

**Files:**
- Modify: `src/command/history/sessions.js`
- Modify: `test/command/codex-visible-project-sessions.test.js`

**Interfaces:**
- Consumes: `isCodexSubagentSource(threadSource, source)` from Task 1.
- Produces: `sqliteTableColumns(db, tableName): Set<string>` and a schema-aware SQL visibility predicate used only by the Codex state database reader.

- [x] **Step 1: Write failing SQLite tests**

Add three tests using temporary `state_5.sqlite` databases:

```js
test('Codex SQLite listing filters Subagents before limit', () => {
  // Insert two newer rows with thread_source='subagent' and source JSON,
  // then one older row with thread_source='user'. Request limit: 1.
  // Assert the older user row is returned.
});

test('Codex SQLite listing filters serialized Subagent source', () => {
  // Use a schema with source but no thread_source, insert one Subagent JSON
  // source and one normal source, and assert only the normal row is returned.
});

test('Codex SQLite listing supports legacy threads schema', () => {
  // Use the existing legacy columns without source/thread_source.
  // Assert the session still loads instead of falling back or returning empty.
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test test/command/codex-visible-project-sessions.test.js
```

Expected: the pre-limit and serialized-source tests fail because Subagent rows are returned or consume the limit; the legacy-schema test passes.

- [x] **Step 3: Implement dynamic SQLite predicates**

Add a helper based on `PRAGMA table_info(threads)`:

```js
function sqliteTableColumns(db, tableName) {
  return new Set(db.prepare(`PRAGMA table_info(${tableName})`).all()
    .map(row => stringOrEmpty(row.name))
    .filter(Boolean));
}
```

Build the query predicate before preparing the statement:

```js
const columns = sqliteTableColumns(db, 'threads');
const visibilityPredicates = [];
if (columns.has('thread_source')) {
  visibilityPredicates.push("COALESCE(thread_source, '') <> 'subagent'");
}
if (columns.has('source')) {
  visibilityPredicates.push("COALESCE(source, '') NOT LIKE '%\"subagent\"%'");
}
const visibilitySql = visibilityPredicates.length > 0
  ? ` AND ${visibilityPredicates.join(' AND ')}`
  : '';
```

Append `visibilitySql` after the `cwd IN (...)` clause and before `ORDER BY ... LIMIT ?`. Include `thread_source` and `source` in the selected columns only when available, or keep filtering entirely in SQL so legacy schemas do not reference missing columns.

- [x] **Step 4: Re-run focused tests and verify GREEN**

Run:

```bash
node --test test/command/codex-visible-project-sessions.test.js
```

Expected: all JSONL, SQLite, legacy-schema, and Claude compatibility tests pass.

- [x] **Step 5: Run the existing session command regression tests**

Run:

```bash
node --test test/command/linco-local-command-turn-end.test.js
```

Expected: all existing `/sessions`, workspace alias, history, and binding checks pass. If the known Node executable-path assertion fails, confirm all session/history assertions completed before that unrelated failure and report it separately.

- [x] **Step 6: Commit the SQLite task**

```bash
git add src/command/history/sessions.js test/command/codex-visible-project-sessions.test.js
git commit -m "fix: filter Codex subagents before session limit"
```

### Task 3: Documentation And Final Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-codex-visible-project-sessions.md`

**Interfaces:**
- No new runtime interfaces.

- [x] **Step 1: Run focused and full plugin verification**

Run:

```bash
node --check src/command/history/readers.js
node --check src/command/history/sessions.js
node --test test/command/codex-visible-project-sessions.test.js
npm test
git diff HEAD --check
```

Expected: syntax checks and focused tests pass. Full-suite failures unrelated to session filtering must be listed separately with their exact test name.

- [x] **Step 2: Confirm the live data rule against the observed Codex schema**

Verify that the implementation recognizes both current representations:

```text
thread_source = "subagent"
source = {"subagent":{"thread_spawn":{...}}}
```

Confirm user-visible rows such as `thread_source = "user"` remain visible.

- [x] **Step 3: Update checklist status and commit the plan record**

Mark completed steps in this plan, then run:

```bash
git add docs/superpowers/plans/2026-07-13-codex-visible-project-sessions.md
git commit -m "docs: record Codex session filtering verification"
```
