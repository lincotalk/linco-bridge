function parseArgs(args) {
  const options = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      options._.push(arg);
      continue;
    }

    const eq = arg.indexOf('=');
    const key = eq > 2 ? arg.slice(2, eq) : arg.slice(2);
    const value = eq > 2 ? arg.slice(eq + 1) : args[i + 1];

    if (['force', 'help', 'version', 'daemon', 'daemon-child', 'local-im', 'mock-im', 'clear', 'allow-insecure-ws'].includes(key)) {
      options[key] = true;
      continue;
    }

    if (value == null || String(value).startsWith('--')) {
      throw new Error(`参数 --${key} 缺少值`);
    }
    options[key] = value;
    if (eq < 0) i += 1;
  }
  return options;
}

module.exports = {
  parseArgs,
};
