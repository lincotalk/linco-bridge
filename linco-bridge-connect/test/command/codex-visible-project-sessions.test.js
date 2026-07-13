const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { encodeClaudeProjectDir } = require('../../src/command/project');
const {
  collectClaudeProjectSessions,
  collectCodexProjectSessions,
} = require('../../src/command/history/sessions');

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
