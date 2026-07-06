const assert = require('node:assert/strict');
const test = require('node:test');
const {
  lincoFilesToAttachments,
  normalizeLincoFiles,
  normalizeOutboundFiles,
} = require('../src');

test('normalizes inbound file array and legacy media fields', () => {
  const files = normalizeLincoFiles({
    files: [{ name: 'a.txt', mimeType: 'text/plain', base64: 'YQ==' }],
    mediaName: 'b.png',
    mediaType: 'image/png',
    mediaBase64: 'Yg==',
  });

  assert.equal(files.length, 2);
  assert.deepEqual(lincoFilesToAttachments(files), [
    { name: 'a.txt', mimeType: 'text/plain', base64: 'YQ==', url: '' },
    { name: 'b.png', mimeType: 'image/png', base64: 'Yg==', url: '' },
  ]);
});

test('normalizes outbound media fields into files', () => {
  assert.deepEqual(normalizeOutboundFiles({
    mediaName: 'report.pdf',
    mediaType: 'application/pdf',
    mediaUrl: 'https://example.test/report.pdf',
  }), [{
    name: 'report.pdf',
    type: 'application/pdf',
    mimeType: 'application/pdf',
    url: 'https://example.test/report.pdf',
    mediaUrl: 'https://example.test/report.pdf',
  }]);
});
