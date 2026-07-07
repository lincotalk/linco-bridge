const assert = require('assert');
const {
  isLocalRequestAuthorized,
  localTokenCookieHeader,
  requestToken,
  _internal,
} = require('../../src/local/auth');

const config = { localWeb: { token: 'local-secret' } };

assert.strictEqual(
  requestToken({
    url: '/?localToken=query-secret',
    headers: { cookie: 'lincoLocalToken=cookie-secret' },
  }),
  'query-secret'
);

assert.strictEqual(
  requestToken({
    url: '/',
    headers: {
      authorization: 'Bearer header-secret',
      cookie: 'lincoLocalToken=cookie-secret',
    },
  }),
  'header-secret'
);

assert.strictEqual(
  requestToken({
    url: '/',
    headers: { cookie: 'other=1; lincoLocalToken=local-secret' },
  }),
  'local-secret'
);

assert.strictEqual(
  isLocalRequestAuthorized({
    url: '/',
    headers: { cookie: 'lincoLocalToken=local-secret' },
  }, config),
  true
);

assert.strictEqual(
  isLocalRequestAuthorized({
    url: '/',
    headers: { cookie: 'lincoLocalToken=stale-secret' },
  }, config),
  false
);

const cookieHeader = localTokenCookieHeader(config);
assert.match(cookieHeader, /^lincoLocalToken=local-secret; Path=\/; HttpOnly; SameSite=Strict; Max-Age=\d+$/);
assert.deepStrictEqual(_internal.parseCookies('a=1; lincoLocalToken=hello%20world'), {
  a: '1',
  lincoLocalToken: 'hello world',
});

console.log('local auth ok');
