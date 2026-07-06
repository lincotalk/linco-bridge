function buildPcResumeCommand(agentType, workspace, resumeId, platform = process.platform) {
  if (agentType === 'codex') {
    return {
      language: 'text',
      text: `codex resume --cd ${shellQuote(workspace, platform)} ${shellQuote(resumeId, platform)}`,
    };
  }

  const cdCommand = platform === 'win32'
    ? `cd /d ${shellQuote(workspace, platform)}`
    : `cd ${shellQuote(workspace, platform)}`;
  const separator = platform === 'win32' ? '&&' : ';';
  return {
    language: 'text',
    text: platform === 'win32'
      ? `${cdCommand} ${separator} claude --resume ${shellQuote(resumeId, platform)}`
      : `${cdCommand}${separator} claude --resume ${shellQuote(resumeId, platform)}`,
  };
}

function shellQuote(value, platform = process.platform) {
  const text = String(value || '');
  if (platform === 'win32') {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return `'${text.replace(/'/g, "'\\''")}'`;
}

module.exports = {
  buildPcResumeCommand,
  shellQuote,
};
