function unquoteProjectPath(value) {
  const trimmed = String(value || '').trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\(["\\])/g, '$1');
  }
  return trimmed;
}

function splitCommandArgs(value) {
  const input = String(value || '').trim();
  const args = [];
  let current = '';
  let quote = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '\\' && quote === '"' && ['\\', '"'].includes(input[i + 1])) {
      current += input[++i];
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (quote) return { ok: false, message: '参数引号未闭合。' };
  if (current) args.push(current);
  return { ok: true, args };
}

module.exports = {
  splitCommandArgs,
  unquoteProjectPath,
};
