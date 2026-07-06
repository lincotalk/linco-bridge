const { spawnSync } = require('child_process');
const path = require('path');

const cliFlags = process.argv.slice(2);
const cli = path.join(__dirname, 'bin', 'linco-connect.js');
const result = spawnSync(process.execPath, [cli, 'start', ...cliFlags], {
  cwd: __dirname,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});
process.exit(result.status || 0);
