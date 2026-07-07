const crypto = require('crypto');
const { updateUserConfig } = require('../config');

function ensureLocalToken(config) {
  if (config.localWeb?.token) return config.localWeb.token;

  const token = crypto.randomBytes(32).toString('hex');
  updateUserConfig((userConfig) => {
    userConfig.localWeb = {
      ...(userConfig.localWeb || {}),
      token,
    };
    return userConfig;
  }, config.configFile);
  config.localWeb = { ...(config.localWeb || {}), token };
  return token;
}

function requestToken(req, url = null) {
  const parsedUrl = url || new URL(req.url || '/', 'http://localhost');
  const queryToken = parsedUrl.searchParams.get('localToken') || parsedUrl.searchParams.get('token');
  if (queryToken) return queryToken;

  const header = req.headers?.authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function isLocalRequestAuthorized(req, config, url = null) {
  const token = config.localWeb?.token;
  return !!token && requestToken(req, url) === token;
}

function localUrlWithToken(config) {
  const host = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
  const url = new URL(`http://${host}:${config.port}/`);
  if (config.localWeb?.token) url.searchParams.set('localToken', config.localWeb.token);
  return url.toString();
}

module.exports = {
  ensureLocalToken,
  isLocalRequestAuthorized,
  localUrlWithToken,
  requestToken,
};
