const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  mapCodexProjectListResult,
  mergeCodexProjectRows,
} = require('../../src/agent/codex')._internal;

test('mapCodexProjectListResult expands project roots into workspace rows', () => {
  const rows = mapCodexProjectListResult({
    data: [
      {
        id: 'proj-a',
        name: 'Alpha',
        updatedAt: 1700000000000,
        roots: [{ path: 'D:\\work\\alpha' }, { path: 'D:\\work\\alpha-docs' }],
      },
      {
        id: 'proj-b',
        name: 'Beta',
        updatedAt: 1700000001000,
        roots: ['D:\\work\\beta'],
      },
    ],
    nextCursor: null,
  });

  assert.deepEqual(rows, [
    {
      path: 'D:\\work\\alpha',
      title: 'Alpha',
      workspaceId: 'proj-a',
      updatedAt: 1700000000000,
    },
    {
      path: 'D:\\work\\alpha-docs',
      title: 'Alpha',
      workspaceId: 'proj-a',
      updatedAt: 1700000000000,
    },
    {
      path: 'D:\\work\\beta',
      title: 'Beta',
      workspaceId: 'proj-b',
      updatedAt: 1700000001000,
    },
  ]);
});

test('mergeCodexProjectRows prefers RPC rows and keeps local-only paths', () => {
  const rpc = [
    {
      path: path.join('D:', 'work', 'shared'),
      title: 'From RPC',
      workspaceId: 'rpc-1',
      updatedAt: 2,
    },
  ];
  const local = [
    {
      path: path.join('D:', 'work', 'shared'),
      title: 'From Local',
      workspaceId: 'local-1',
      updatedAt: 1,
    },
    {
      path: path.join('D:', 'work', 'local-only'),
      title: 'Local Only',
      workspaceId: 'local-2',
      updatedAt: 3,
    },
  ];

  const merged = mergeCodexProjectRows(rpc, local);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].title, 'From RPC');
  assert.equal(merged[0].workspaceId, 'rpc-1');
  assert.equal(merged[1].title, 'Local Only');
});
