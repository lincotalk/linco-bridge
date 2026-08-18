const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { handleGet } = require('../../src/command/fileGet');

test('splits large /get files into ordered websocket-safe chunks', (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-file-get-chunk-'));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const filePath = path.join(workspace, 'demo.mp4');
  const source = Buffer.alloc(2 * 1024 * 1024 + 7, 0x5a);
  fs.writeFileSync(filePath, source);

  const sent = [];
  const ws = { send: payload => sent.push(JSON.parse(payload)) };
  const session = {
    id: 'session-file-chunk',
    workspace,
    runtimeDir: workspace,
    attachmentsDir: path.join(workspace, 'attachments'),
    agentType: 'codex',
  };

  handleGet(filePath, ws, session, {});

  const chunks = sent.filter(message => message.mediaBase64Chunk);
  assert(chunks.length > 1);
  assert(chunks.every(message => message.type === 'outbound_message'));
  assert(chunks.every(message => message.mediaChunkCount === chunks.length));
  assert.deepEqual(chunks.map(message => message.mediaChunkIndex),
    Array.from({ length: chunks.length }, (_, index) => index));
  assert(chunks.every(message => message.mediaBase64Chunk.length <= 1024 * 1024));
  assert(chunks.every(message => message.mediaBase64 === undefined));
  assert.equal(chunks.map(message => message.mediaBase64Chunk).join(''), source.toString('base64'));
});

test('rejects oversized /get files before reading them into memory', (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-file-get-limit-'));
  const filePath = path.join(workspace, 'oversized.mp4');
  fs.writeFileSync(filePath, '');
  fs.truncateSync(filePath, 50 * 1024 * 1024 + 1);
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

  const originalReadFileSync = fs.readFileSync;
  let readAttempted = false;
  fs.readFileSync = function readFileSync(target, ...args) {
    if (path.resolve(String(target)) === path.resolve(filePath)) {
      readAttempted = true;
      return Buffer.alloc(0);
    }
    return originalReadFileSync.call(fs, target, ...args);
  };
  t.after(() => {
    fs.readFileSync = originalReadFileSync;
  });

  const sent = [];
  const ws = { send: payload => sent.push(JSON.parse(payload)) };
  const session = {
    id: 'session-file-limit',
    workspace,
    runtimeDir: workspace,
    attachmentsDir: path.join(workspace, 'attachments'),
    agentType: 'codex',
  };

  handleGet(filePath, ws, session, {});

  assert.equal(readAttempted, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, 'error');
  assert.match(sent[0].text, /50 MB/);
});
