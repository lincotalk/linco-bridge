const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '../../../public/index.html'), 'utf8');

const ensureMatch = html.match(/function ensureAssistantTurn\(\) \{([\s\S]*?)\r?\n    \}\r?\n\r?\n    function createActionPanel\(\)/);
assert(ensureMatch, 'ensureAssistantTurn function should exist');

const body = ensureMatch[1];
const actionPanelIndex = body.indexOf('container.appendChild(actionPanel.panel)');
const contentIndex = body.indexOf('container.appendChild(content)');
const currentMsgIndex = body.indexOf('currentAssistantMsg = content');

assert(actionPanelIndex >= 0, 'action panel should be appended to assistant container');
assert(contentIndex >= 0, 'assistant content should be appended to assistant container');
assert(currentMsgIndex >= 0, 'assistant chunks should render into assistant content');
assert(actionPanelIndex < contentIndex, 'action panel should render before final answer content');
assert(contentIndex < currentMsgIndex, 'current assistant target should be the content node');
assert(!body.includes('actionPanel.details.appendChild(content)'), 'final answer must not be inside collapsible details');
assert(!body.includes('actionPanel.list.appendChild(content)'), 'final answer must not be inside action list');

const socketMatch = html.match(/function handleSocketMessage\(event\) \{([\s\S]*?)\r?\n    \}\r?\n\r?\n    function handleStreamChunk/);
assert(socketMatch, 'handleSocketMessage function should exist');
const turnEndMatch = socketMatch[1].match(/case 'turn_end':([\s\S]*?)break;/);
assert(turnEndMatch, 'turn_end branch should exist');
assert(turnEndMatch[1].includes('clearThinking()'), 'turn_end should close active thinking');
assert(turnEndMatch[1].includes('completeAssistantTurn()'), 'turn_end should finalize assistant UI');
assert(turnEndMatch[1].includes('setRunning(false)'), 'turn_end should stop running state');

const presenceMatch = socketMatch[1].match(/case 'presence_event':([\s\S]*?)break;/);
assert(presenceMatch, 'presence_event branch should exist');
assert(presenceMatch[1].includes('addPresenceMessage(data)'), 'presence_event should render device presence details');
assert(html.includes('function addPresenceMessage(data)'), 'presence renderer should exist');

console.log('mock im structure ok');
