const DANGEROUS_PATTERNS = [
  /\brm\s+-rf?\b/i,
  /\bsudo\b/i,
  /\bchmod\s+777\b/i,
  /\bcurl.*\|.*sh\b/i,
  /\bwget.*-O.*\|\s*sh\b/i,
  /\b>\/dev\/sd[a-z]\b/i,
  /\bdd\s+if=/i,
  /\bmkfs\./i,
  /\b:(){ :|:& };:\b/i,
];

function isDangerousCommand(text) {
  if (typeof text !== 'string') return false;
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(text));
}

module.exports = {
  DANGEROUS_PATTERNS,
  isDangerousCommand,
};
