const path = require('path');
const { parseArgs } = require('./args');
const { printHelp } = require('./help');
const { initCommand } = require('./init');
const { removeAccountCommand } = require('./accounts');
const { wsPrefixCommand } = require('./wsPrefix');
const {
  reloadCommand,
  startCommand,
  statusCommand,
  stopCommand,
} = require('./daemon');
const { doctorCommand } = require('./doctor');
const pkg = require('../../package.json');

const rootDir = path.resolve(__dirname, '..', '..');
const cliFile = __filename;

if (require.main === module) {
  main().catch((err) => {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0] && !argv[0].startsWith('-') ? argv.shift() : 'help';
  const options = parseArgs(argv);
  const context = { rootDir, cliFile, pkg };

  if (options.version || command === 'version') {
    console.log(pkg.version);
    return;
  }

  if (options.help || command === 'help') {
    printHelp(pkg);
    return;
  }

  switch (command) {
    case 'init':
      initCommand(options, context);
      break;
    case 'remove-account':
    case 'delete-account':
      removeAccountCommand(options, context);
      break;
    case 'ws-prefix':
      wsPrefixCommand(options, context);
      break;
    case 'start':
      await startCommand(options, context);
      break;
    case 'stop':
      await stopCommand(context);
      break;
    case 'reload':
      await reloadCommand(context);
      break;
    case 'status':
      statusCommand(context);
      break;
    case 'doctor':
      await doctorCommand(context);
      break;
    default:
      throw new Error(`未知命令: ${command}\n运行 linco-connect --help 查看用法。`);
  }
}

module.exports = {
  main,
};
