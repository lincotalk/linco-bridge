const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const Database = require('better-sqlite3');
const { encodeClaudeProjectDir } = require('../../src/command/project');
const {
  collectClaudeProjectSessions,
  collectCodexProjectSessions,
} = require('../../src/command/history/sessions');

function createCodexStateDb(codexDir, schemaSql, rows) {
  fs.mkdirSync(codexDir, { recursive: true });
  const db = new Database(path.join(codexDir, 'state_5.sqlite'));
  db.exec(schemaSql);
  const insert = db.prepare(`
    INSERT INTO threads (${rows.columns.join(', ')})
    VALUES (${rows.columns.map(() => '?').join(', ')})
  `);
  for (const values of rows.values) {
    insert.run(...values);
  }
  db.close();
}

const LEGACY_THREADS_SCHEMA = `
  CREATE TABLE threads (
    id TEXT PRIMARY KEY,
    rollout_path TEXT NOT NULL,
    cwd TEXT NOT NULL,
    title TEXT NOT NULL,
    first_user_message TEXT NOT NULL DEFAULT '',
    preview TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    updated_at_ms INTEGER,
    recency_at_ms INTEGER NOT NULL DEFAULT 0
  );
`;

const SOURCE_THREADS_SCHEMA = `
  CREATE TABLE threads (
    id TEXT PRIMARY KEY,
    rollout_path TEXT NOT NULL,
    cwd TEXT NOT NULL,
    title TEXT NOT NULL,
    first_user_message TEXT NOT NULL DEFAULT '',
    preview TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    updated_at_ms INTEGER,
    recency_at_ms INTEGER NOT NULL DEFAULT 0,
    source TEXT
  );
`;

const FULL_THREADS_SCHEMA = `
  CREATE TABLE threads (
    id TEXT PRIMARY KEY,
    rollout_path TEXT NOT NULL,
    cwd TEXT NOT NULL,
    title TEXT NOT NULL,
    first_user_message TEXT NOT NULL DEFAULT '',
    preview TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    updated_at_ms INTEGER,
    recency_at_ms INTEGER NOT NULL DEFAULT 0,
    thread_source TEXT,
    source TEXT
  );
`;

test('Codex JSONL listing excludes Subagent sessions', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-visible-sessions-'));
  const project = path.join(homeDir, 'code', 'codex-visible-project');
  fs.mkdirSync(project, { recursive: true });

  const sessionsDir = path.join(homeDir, '.codex', 'sessions', '2026', '07', '13');
  fs.mkdirSync(sessionsDir, { recursive: true });

  fs.writeFileSync(path.join(sessionsDir, 'main-session.jsonl'), [
    JSON.stringify({
      type: 'session_meta',
      payload: { id: 'codex-main', cwd: project, source: 'vscode' },
    }),
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'main session prompt' }],
      },
    }),
  ].join('\n'));

  fs.writeFileSync(path.join(sessionsDir, 'subagent-session.jsonl'), [
    JSON.stringify({
      type: 'session_meta',
      payload: {
        id: 'codex-subagent',
        cwd: project,
        source: { subagent: { thread_spawn: { parent_thread_id: 'parent' } } },
      },
    }),
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'subagent session prompt' }],
      },
    }),
  ].join('\n'));

  const sessions = collectCodexProjectSessions(homeDir, project, { scanLimit: 10 });
  assert.deepEqual(sessions.map(item => item.id), ['codex-main']);
});

test('Codex SQLite listing filters Subagents before limit', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-sqlite-subagent-limit-'));
  const project = path.join(homeDir, 'code', 'codex-sqlite-project');
  const codexDir = path.join(homeDir, '.codex');
  fs.mkdirSync(project, { recursive: true });

  const subagentSource = JSON.stringify({ subagent: { thread_spawn: { parent_thread_id: 'parent' } } });
  createCodexStateDb(codexDir, FULL_THREADS_SCHEMA, {
    columns: [
      'id', 'rollout_path', 'cwd', 'title', 'first_user_message', 'preview',
      'archived', 'updated_at', 'updated_at_ms', 'recency_at_ms', 'thread_source', 'source',
    ],
    values: [
      ['codex-subagent-newer', path.join(codexDir, 'subagent-newer.jsonl'), project, 'newer subagent', 'newer subagent prompt', '', 0, 0, 1778060000000, 1778060000000, 'subagent', subagentSource],
      ['codex-subagent-newest', path.join(codexDir, 'subagent-newest.jsonl'), project, 'newest subagent', 'newest subagent prompt', '', 0, 0, 1778070000000, 1778070000000, 'subagent', subagentSource],
      ['codex-user-older', path.join(codexDir, 'user-older.jsonl'), project, 'older user', 'older user prompt', '', 0, 0, 1778050000000, 1778050000000, 'user', 'vscode'],
    ],
  });

  const sessions = collectCodexProjectSessions(homeDir, project, { limit: 1 });
  assert.deepEqual(sessions.map(item => item.id), ['codex-user-older']);
});

test('Codex SQLite listing filters serialized Subagent source', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-sqlite-serialized-source-'));
  const project = path.join(homeDir, 'code', 'codex-sqlite-project');
  const codexDir = path.join(homeDir, '.codex');
  fs.mkdirSync(project, { recursive: true });

  const subagentSource = JSON.stringify({ subagent: { thread_spawn: { parent_thread_id: 'parent' } } });
  createCodexStateDb(codexDir, SOURCE_THREADS_SCHEMA, {
    columns: [
      'id', 'rollout_path', 'cwd', 'title', 'first_user_message', 'preview',
      'archived', 'updated_at', 'updated_at_ms', 'recency_at_ms', 'source',
    ],
    values: [
      ['codex-subagent-serialized', path.join(codexDir, 'subagent-serialized.jsonl'), project, 'serialized subagent', 'serialized subagent prompt', '', 0, 0, 1778070000000, 1778070000000, subagentSource],
      ['codex-main-serialized', path.join(codexDir, 'main-serialized.jsonl'), project, 'main session', 'main session prompt', '', 0, 0, 1778050000000, 1778050000000, 'vscode'],
    ],
  });

  const sessions = collectCodexProjectSessions(homeDir, project, { limit: 10 });
  assert.deepEqual(sessions.map(item => item.id), ['codex-main-serialized']);
});

test('Codex SQLite listing supports legacy threads schema', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-sqlite-legacy-schema-'));
  const project = path.join(homeDir, 'code', 'codex-sqlite-project');
  const codexDir = path.join(homeDir, '.codex');
  fs.mkdirSync(project, { recursive: true });

  createCodexStateDb(codexDir, LEGACY_THREADS_SCHEMA, {
    columns: [
      'id', 'rollout_path', 'cwd', 'title', 'first_user_message', 'preview',
      'archived', 'updated_at', 'updated_at_ms', 'recency_at_ms',
    ],
    values: [
      ['codex-legacy-session', path.join(codexDir, 'legacy-session.jsonl'), project, 'legacy title', 'legacy prompt', '', 0, 0, 1778050000000, 1778050000000],
    ],
  });

  const sessions = collectCodexProjectSessions(homeDir, project, { limit: 10 });
  assert.deepEqual(sessions.map(item => item.id), ['codex-legacy-session']);
});

test('Codex SQLite listing merges symlink and realpath workspace sessions before limit', (t) => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-sqlite-workspace-aliases-'));
  const realProject = path.join(homeDir, 'real', 'aichat');
  const linkProject = path.join(homeDir, 'link', 'aichat');
  const codexDir = path.join(homeDir, '.codex');
  fs.mkdirSync(realProject, { recursive: true });
  fs.mkdirSync(path.dirname(linkProject), { recursive: true });
  try {
    fs.symlinkSync(realProject, linkProject, 'dir');
  } catch (error) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES') {
      t.skip('directory symlinks are not available');
      return;
    }
    throw error;
  }
  const realProjectCwd = fs.realpathSync.native(realProject);

  createCodexStateDb(codexDir, FULL_THREADS_SCHEMA, {
    columns: [
      'id', 'rollout_path', 'cwd', 'title', 'first_user_message', 'preview',
      'archived', 'updated_at', 'updated_at_ms', 'recency_at_ms', 'thread_source', 'source',
    ],
    values: [
      ['codex-link-older', path.join(codexDir, 'link-older.jsonl'), linkProject, 'link older', 'link older prompt', '', 0, 0, 1778050000000, 1778050000000, 'user', 'appServer'],
      ['codex-real-newer', path.join(codexDir, 'real-newer.jsonl'), realProjectCwd, 'real newer', 'real newer prompt', '', 0, 0, 1778060000000, 1778060000000, 'user', 'appServer'],
    ],
  });

  const linkedSessions = collectCodexProjectSessions(homeDir, linkProject, { limit: 2 });
  assert.deepEqual(
    linkedSessions.map(item => item.id),
    ['codex-real-newer', 'codex-link-older'],
  );
  const latestLinkedSession = collectCodexProjectSessions(homeDir, linkProject, { limit: 1 });
  assert.deepEqual(latestLinkedSession.map(item => item.id), ['codex-real-newer']);

  const realSessions = collectCodexProjectSessions(homeDir, realProjectCwd, { limit: 2 });
  assert.deepEqual(realSessions.map(item => item.id), ['codex-real-newer']);
});

test('Codex JSONL listing merges symlink and realpath workspace sessions before limit', (t) => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-jsonl-workspace-aliases-'));
  const realProject = path.join(homeDir, 'real', 'aichat');
  const linkProject = path.join(homeDir, 'link', 'aichat');
  const sessionsDir = path.join(homeDir, '.codex', 'sessions', '2026', '07', '24');
  fs.mkdirSync(realProject, { recursive: true });
  fs.mkdirSync(path.dirname(linkProject), { recursive: true });
  try {
    fs.symlinkSync(realProject, linkProject, 'dir');
  } catch (error) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES') {
      t.skip('directory symlinks are not available');
      return;
    }
    throw error;
  }
  fs.mkdirSync(sessionsDir, { recursive: true });
  const realProjectCwd = fs.realpathSync.native(realProject);
  const linkSessionPath = path.join(sessionsDir, 'link-older.jsonl');
  const realSessionPath = path.join(sessionsDir, 'real-newer.jsonl');

  fs.writeFileSync(linkSessionPath, [
    JSON.stringify({
      type: 'session_meta',
      payload: { id: 'codex-jsonl-link-older', cwd: linkProject, source: 'appServer' },
    }),
    JSON.stringify({
      type: 'event_msg',
      payload: { type: 'user_message', message: 'link older prompt' },
    }),
  ].join('\n'));
  fs.writeFileSync(realSessionPath, [
    JSON.stringify({
      type: 'session_meta',
      payload: { id: 'codex-jsonl-real-newer', cwd: realProjectCwd, source: 'appServer' },
    }),
    JSON.stringify({
      type: 'event_msg',
      payload: { type: 'user_message', message: 'real newer prompt' },
    }),
  ].join('\n'));
  fs.utimesSync(linkSessionPath, new Date(1778050000000), new Date(1778050000000));
  fs.utimesSync(realSessionPath, new Date(1778060000000), new Date(1778060000000));

  const linkedSessions = collectCodexProjectSessions(homeDir, linkProject, {
    limit: 2,
    scanLimit: 10,
  });
  assert.deepEqual(
    linkedSessions.map(item => item.id),
    ['codex-jsonl-real-newer', 'codex-jsonl-link-older'],
  );
  const latestLinkedSession = collectCodexProjectSessions(homeDir, linkProject, {
    limit: 1,
    scanLimit: 10,
  });
  assert.deepEqual(latestLinkedSession.map(item => item.id), ['codex-jsonl-real-newer']);

  const realSessions = collectCodexProjectSessions(homeDir, realProjectCwd, {
    limit: 2,
    scanLimit: 10,
  });
  assert.deepEqual(realSessions.map(item => item.id), ['codex-jsonl-real-newer']);
});

test('Claude top-level project session listing remains unchanged', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-claude-visible-sessions-'));
  const project = path.join(homeDir, 'code', 'claude-visible-project');
  fs.mkdirSync(project, { recursive: true });

  const projectDir = path.join(homeDir, '.claude', 'projects', encodeClaudeProjectDir(project));
  fs.mkdirSync(projectDir, { recursive: true });

  fs.writeFileSync(path.join(projectDir, 'claude-session-a.jsonl'), [
    JSON.stringify({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: 'first claude prompt' }] },
    }),
  ].join('\n'));

  fs.writeFileSync(path.join(projectDir, 'claude-session-b.jsonl'), [
    JSON.stringify({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: 'second claude prompt' }] },
    }),
  ].join('\n'));

  const sessions = collectClaudeProjectSessions(homeDir, project);
  assert.deepEqual(
    sessions.map(item => item.id).sort(),
    ['claude-session-a', 'claude-session-b'],
  );
});
