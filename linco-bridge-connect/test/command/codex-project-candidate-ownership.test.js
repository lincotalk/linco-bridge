const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { _internal: slashCommandInternals } = require('../../src/command');

test('Codex 项目路径重复归属时优先使用目录名匹配的项目', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-project-ownership-'));
  const linkflowPath = path.join(homeDir, 'code', 'linkflow');
  const aichatPath = path.join(homeDir, 'code', 'aichat');
  const linkflowProjectId = 'codex-project-linkflow';
  const aichatProjectId = 'codex-project-aichat';
  fs.mkdirSync(linkflowPath, { recursive: true });
  fs.mkdirSync(aichatPath, { recursive: true });
  fs.mkdirSync(path.join(homeDir, '.codex'), { recursive: true });

  fs.writeFileSync(path.join(homeDir, '.codex', '.codex-global-state.json'), JSON.stringify({
    'project-order': [linkflowProjectId, aichatProjectId],
    'local-projects': {
      [linkflowProjectId]: {
        id: linkflowProjectId,
        name: 'linkflow',
        rootPaths: [linkflowPath, aichatPath],
      },
      [aichatProjectId]: {
        id: aichatProjectId,
        name: 'aichat',
        rootPaths: [aichatPath],
      },
    },
  }));

  const candidates = slashCommandInternals.knownProjectCandidates(
    { agentType: 'codex' },
    { homeDir },
  );

  assert.deepStrictEqual(
    candidates.map(item => ({ path: item.path, label: item.label, projectId: item.projectId })),
    [
      { path: linkflowPath, label: 'linkflow', projectId: linkflowProjectId },
      { path: aichatPath, label: 'aichat', projectId: aichatProjectId },
    ],
  );
});

test('Codex 现代项目状态补齐未排序项目并忽略已移除的保存路径', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-project-visibility-'));
  const orderedProject = path.join(homeDir, 'code', 'ordered-project');
  const unorderedProject = path.join(homeDir, 'code', 'unordered-project');
  const removedProject = path.join(homeDir, 'code', 'removed-project');
  const orderedProjectId = 'codex-project-ordered';
  const unorderedProjectId = 'codex-project-unordered';
  fs.mkdirSync(orderedProject, { recursive: true });
  fs.mkdirSync(unorderedProject, { recursive: true });
  fs.mkdirSync(removedProject, { recursive: true });
  fs.mkdirSync(path.join(homeDir, '.codex', 'sessions', '2026', '08', '21'), { recursive: true });

  fs.writeFileSync(path.join(homeDir, '.codex', '.codex-global-state.json'), JSON.stringify({
    'project-order': [orderedProjectId],
    'local-projects': {
      [orderedProjectId]: {
        id: orderedProjectId,
        name: 'Ordered project',
        rootPaths: [orderedProject],
      },
      [unorderedProjectId]: {
        id: unorderedProjectId,
        name: 'Unordered project',
        rootPaths: [unorderedProject],
      },
    },
    'active-workspace-roots': [orderedProject],
    'electron-saved-workspace-roots': [removedProject],
  }));
  fs.writeFileSync(
    path.join(homeDir, '.codex', 'sessions', '2026', '08', '21', 'rollout.jsonl'),
    JSON.stringify({ type: 'session_meta', payload: { cwd: removedProject } }) + '\n',
  );

  const candidates = slashCommandInternals.knownProjectCandidates(
    { agentType: 'codex' },
    { homeDir },
  );

  assert.deepStrictEqual(
    candidates.map(item => ({ path: item.path, projectId: item.projectId })),
    [
      { path: orderedProject, projectId: orderedProjectId },
      { path: unorderedProject, projectId: unorderedProjectId },
    ],
  );
});

test('Codex 空的现代项目状态不会从历史会话恢复已隐藏项目', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-hidden-project-'));
  const hiddenProject = path.join(homeDir, 'code', 'hidden-project');
  const sessionsDir = path.join(homeDir, '.codex', 'sessions', '2026', '08', '21');
  fs.mkdirSync(hiddenProject, { recursive: true });
  fs.mkdirSync(sessionsDir, { recursive: true });

  fs.writeFileSync(path.join(homeDir, '.codex', '.codex-global-state.json'), JSON.stringify({
    'project-order': [],
    'local-projects': {},
    'active-workspace-roots': [],
    'electron-saved-workspace-roots': [hiddenProject],
  }));
  fs.writeFileSync(
    path.join(sessionsDir, 'rollout.jsonl'),
    JSON.stringify({ type: 'session_meta', payload: { cwd: hiddenProject } }) + '\n',
  );

  const candidates = slashCommandInternals.knownProjectCandidates(
    { agentType: 'codex' },
    { homeDir },
  );

  assert.deepStrictEqual(candidates, []);
});

test('Codex 旧版状态仍可回退到保存的工作目录', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-legacy-project-'));
  const legacyProject = path.join(homeDir, 'code', 'legacy-project');
  fs.mkdirSync(legacyProject, { recursive: true });
  fs.mkdirSync(path.join(homeDir, '.codex'), { recursive: true });

  fs.writeFileSync(path.join(homeDir, '.codex', '.codex-global-state.json'), JSON.stringify({
    'project-order': [],
    'electron-saved-workspace-roots': [legacyProject],
  }));

  const candidates = slashCommandInternals.knownProjectCandidates(
    { agentType: 'codex' },
    { homeDir },
  );

  assert.deepStrictEqual(candidates.map(item => item.path), [legacyProject]);
});
