const path = require('path');

function encodeClaudeProjectDir(workspace) {
  return path.resolve(workspace)
    .replace(/[^A-Za-z0-9-]/g, '-');
}

module.exports = {
  encodeClaudeProjectDir,
};
