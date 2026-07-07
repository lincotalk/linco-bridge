const linco = require('../linco');
const defaults = require('./defaults');
const protocol = require('./protocol');

module.exports = {
  ...linco,
  ...protocol,
  name: 'linco-demo',
  defaults,
};
