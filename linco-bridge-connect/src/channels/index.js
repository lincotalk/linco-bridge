const registry = require('./registry');
const bridge = require('./bridge/connector');

module.exports = {
  ...registry,
  bridge,
  linco: bridge,
};
