const { sendError } = require('../core/protocol');
const claudeAgent = require('../agents/claude');
const codexAgent = require('../agents/codex');
const {
  GET_MODELS_AND_REASONS_COMMAND,
  parseSettingsArgs,
  validateSettingsApplyArgs,
} = require('./settings');
const {
  agentRunner,
  completeLocalCommand,
  completeMaybeAsyncLocalCommand,
  sendSlashCommandResult,
} = require('./common');

function handleSettingsListCommand(ws, session, config = {}) {
  const agentType = session.agentType || 'claude';
  if (agentType !== 'codex' && agentType !== 'claude') {
    sendError(ws, `Current agent does not support ${GET_MODELS_AND_REASONS_COMMAND}.`);
    return completeLocalCommand(ws, session);
  }
  completeMaybeAsyncLocalCommand(
    buildBridgeSettingsPayload(session, config)
      .then(payload => sendSlashCommandResult(ws, GET_MODELS_AND_REASONS_COMMAND, payload))
      .catch(err => {
        sendError(ws, `Failed to load settings: ${err.message}`);
      }),
    ws,
    session,
  );
  return true;
}

function handleSettingsCommand(rawArg, ws, session, config = {}) {
  const args = parseSettingsArgs(rawArg);
  if (args.mode === 'apply') {
    return handleSettingsApplyCommand(args, ws, session, config);
  }

  return handleSettingsListCommand(ws, session, config);
}

function handleSettingsApplyCommand(args, ws, session, config = {}) {
  const validation = validateSettingsApplyArgs(args);
  if (!validation.ok) {
    sendError(ws, validation.message);
    return completeLocalCommand(ws, session);
  }

  const agentType = session.agentType || 'claude';
  if (agentType !== 'codex' && agentType !== 'claude') {
    sendError(ws, 'Current agent does not support /settings apply.');
    return completeLocalCommand(ws, session);
  }

  const handled = agentRunner().applyAgentSettings(ws, session, config, {
    reasoningEffort: args.reasoningEffort,
    modelId: args.modelId,
    nativeCommand: `/settings apply${args.reasoningEffort ? ` --reasoning ${args.reasoningEffort}` : ''}${args.modelId ? ` --model ${args.modelId}` : ''}`,
    agentType,
  });
  if (!handled) {
    sendError(ws, 'Current agent does not support /settings apply.');
    return completeLocalCommand(ws, session);
  }
  return true;
}

async function buildBridgeSettingsPayload(session, config = {}) {
  const agentType = session.agentType || 'claude';
  if (agentType === 'codex') return buildCodexSettingsPayload(session, config);
  return buildClaudeSettingsPayload(session, config);
}

async function buildCodexSettingsPayload(session, config = {}) {
  const agentConfig = config.agents?.codex || {};
  const currentReasoning = codexAgent._internal.currentCodexReasoningEffort(session);
  const defaultEffort = codexAgent._internal.codexDefaultReasoningEffort(agentConfig);
  const reasoningOptions = codexAgent._internal.uniqueReasoningEfforts([
    'low',
    'medium',
    'high',
    'xhigh',
  ]).map(effort => ({
    id: effort,
    label: formatReasoningLabel(effort),
    command: `/reasoning ${effort}`,
  }));
  const current = String(session.codexModelOverride || '').trim();
  const defaultModel = String(agentConfig.model || '').trim();
  let models = [];
  let listError = '';
  try {
    models = await codexAgent._internal.loadCodexActualModelNames(session, config);
  } catch (err) {
    listError = err.message;
  }
  return {
    agentType: 'codex',
    reasoning: {
      current: currentReasoning,
      defaultEffort,
      model: current || defaultModel,
      options: reasoningOptions,
    },
    model: {
      current,
      defaultModel,
      ...(listError ? { listError } : {}),
      items: models.map(model => ({
        id: model,
        label: model,
        command: `/model ${model}`,
      })),
    },
  };
}

function buildClaudeSettingsPayload(session, config = {}) {
  const agentConfig = config.agents?.claude || {};
  const currentReasoning = claudeAgent._internal.currentClaudeEffort(session, config);
  const defaultEffort = String(agentConfig.effort || 'medium').trim();
  const reasoningOptions = claudeAgent._internal.availableClaudeEfforts().map(effort => ({
    id: effort.name,
    label: formatReasoningLabel(effort.name),
    description: effort.desc,
    command: `/reasoning ${effort.name}`,
  }));
  const current = String(session.claudeModelOverride || '').trim();
  const defaultModel = String(agentConfig.model || '').trim();
  const models = claudeAgent._internal.availableClaudeModels().map(model => model.name);
  return {
    agentType: 'claude',
    reasoning: {
      current: currentReasoning,
      defaultEffort,
      model: current || defaultModel,
      options: reasoningOptions,
    },
    model: {
      current,
      defaultModel,
      items: models.map(model => ({
        id: model,
        label: model,
        command: `/model ${model}`,
      })),
    },
  };
}

function formatReasoningLabel(effort) {
  switch (String(effort || '').trim().toLowerCase()) {
    case 'low':
      return 'Low';
    case 'medium':
      return 'Medium';
    case 'high':
      return 'High';
    case 'xhigh':
      return 'Extra High';
    case 'max':
      return 'Max';
    case 'minimal':
      return 'Minimal';
    case 'none':
      return 'None';
    default:
      return String(effort || '').trim();
  }
}

module.exports = {
  handleSettingsListCommand,
  handleSettingsCommand,
  handleSettingsApplyCommand,
  buildBridgeSettingsPayload,
  formatReasoningLabel,
};
