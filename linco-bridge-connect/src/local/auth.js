const crypto = require('crypto');
const { updateUserConfig } = require('../config');

const LOCAL_TOKEN_COOKIE = 'lincoLocalToken';
const LOCAL_TOKEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

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
  if (match) return match[1].trim();

  return requestCookieToken(req);
}

function isLocalRequestAuthorized(req, config, url = null) {
  const token = config.localWeb?.token;
  return !!token && requestToken(req, url) === token;
}

function requestCookieToken(req) {
  const cookies = parseCookies(req.headers?.cookie);
  return cookies[LOCAL_TOKEN_COOKIE] || '';
}

function parseCookies(cookieHeader) {
  return String(cookieHeader || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf('=');
      if (separator <= 0) return cookies;
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
      return cookies;
    }, {});
}

function localTokenCookieHeader(config) {
  const token = config.localWeb?.token;
  if (!token) return '';
  return `${LOCAL_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${LOCAL_TOKEN_COOKIE_MAX_AGE}`;
}

function setLocalTokenCookie(res, config) {
  const cookie = localTokenCookieHeader(config);
  if (cookie) res.setHeader('Set-Cookie', cookie);
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
  localTokenCookieHeader,
  localUrlWithToken,
  requestToken,
  setLocalTokenCookie,
  _internal: {
    LOCAL_TOKEN_COOKIE,
    parseCookies,
    requestCookieToken,
  },
};
