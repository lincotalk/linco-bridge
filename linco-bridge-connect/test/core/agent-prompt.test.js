const assert = require('assert');
const {
  appendBridgeContextHint,
  buildAgentSystemPrompt,
  buildBridgeIdentityPrompt,
  _internal,
} = require('../../src/core/agentPrompt');

const session = {
  agentType: 'claude',
  workspace: 'C:\\work',
  runtimeDir: 'C:\\runtime',
  attachmentsDir: 'C:\\runtime\\attachments',
};

{
  const prompt = buildBridgeIdentityPrompt();
  assert.match(prompt, /You are running inside Linco Connect/);
  assert.match(prompt, /normal text responses are automatically delivered/);
  assert.doesNotMatch(prompt, /\/get/);
}

{
  const prompt = buildAgentSystemPrompt(session, {
    agents: {
      claude: {
        instructions: 'Use concise replies.',
      },
    },
  });
  assert(prompt.startsWith('Use concise replies.'));
  assert.match(prompt, /You are running inside Linco Connect/);
  assert.match(prompt, /\[filename\.ext\]\(absolute-local-path\)/);
  assert.doesNotMatch(prompt, /\/get/);
}

{
  const input = appendBridgeContextHint('hello');
  assert.match(input, /System note: You are running inside Linco Connect/);
  assert.match(input, /normal text responses are automatically delivered/);
  assert.strictEqual(appendBridgeContextHint(input), input);
}

{
  const input = appendBridgeContextHint([{ type: 'text', text: 'hello' }]);
  assert.strictEqual(input.length, 2);
  assert.strictEqual(input[1].type, 'text');
  assert.strictEqual(input[1].text.startsWith(_internal.BRIDGE_INPUT_HINT_MARKER), true);
}
