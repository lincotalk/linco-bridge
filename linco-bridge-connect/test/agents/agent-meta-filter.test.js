const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const claude = require('../../src/agents/claude');
const hermes = require('../../src/agents/hermes');

function loadCodexInternals() {
  const filename = path.resolve(__dirname, '../../src/agents/codex.js');
  const source = fs.readFileSync(filename, 'utf8');
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(`${source}\nmodule.exports._test = { buildCodexInput, stringifyInput };\n`, filename);
  return mod.exports._test;
}

const codex = loadCodexInternals();

const input = [
  { type: 'text', text: 'hello from IM' },
  {
    type: 'meta',
    agentId: 'remote-agent',
    _lincoMeta: {
      accountId: 'default',
      messageId: 'm-1',
      agentId: 'remote-agent',
    },
  },
];

{
  const payload = claude.buildClaudePayload(input, {}, {});
  assert(payload.message.content.some(block => block.type === 'text' && block.text === 'hello from IM'));
  assert(!payload.message.content.some(block => block.type === 'meta'));
  assert(!claude._internal.extractText(payload.message.content).includes('_lincoMeta'));
}

{
  assert.deepStrictEqual(hermes._internal.buildHermesInput(input), [
    {
      role: 'user',
      content: [{ type: 'text', text: 'hello from IM' }],
    },
  ]);
  assert.strictEqual(hermes._internal.stringifyInput(input), 'hello from IM');
}

{
  assert.deepStrictEqual(codex.buildCodexInput(input, process.cwd()), [
    { type: 'text', text: 'hello from IM' },
  ]);
  assert.strictEqual(codex.stringifyInput(input), 'hello from IM');
}

console.log('agent meta filter ok');
