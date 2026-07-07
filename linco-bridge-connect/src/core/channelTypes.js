const CHANNEL_INBOUND_TYPES = Object.freeze({
  MESSAGE: 'message',
  DANGER_CONFIRM: 'danger_confirm',
  PERMISSION_RESPONSE: 'permission_response',
  HEARTBEAT: 'heartbeat',
});

const CHANNEL_OUTBOUND_TYPES = Object.freeze({
  ASSISTANT_CHUNK: 'assistant_chunk',
  ASSISTANT_END: 'assistant_end',
  THINKING: 'thinking',
  THINKING_CLEAR: 'thinking_clear',
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
  SLASH_COMMAND_RESULT: 'slash_command_result',
  TURN_END: 'turn_end',
  ERROR: 'error',
  SYSTEM: 'system',
});

module.exports = {
  CHANNEL_INBOUND_TYPES,
  CHANNEL_OUTBOUND_TYPES,
};
