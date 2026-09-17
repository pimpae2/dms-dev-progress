import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSheet } from '../netlify/sheet-handler.mjs';
import { PROJECT_WORKBOOK_ID } from '../netlify/workbook-handler.mjs';
const request = new Request('https://example.test/api/sheet?gid=0');
test('reads CSV only from Google without credentials', async () => {
  const response = await readSheet(request, async (url, options) => {
    assert.equal(url, `https://docs.google.com/spreadsheets/d/${PROJECT_WORKBOOK_ID}/gviz/tq?tqx=out:csv&gid=0`);
    assert.equal(options.accept, 'text/csv');
    return { ok: true, status: 200, contentType: 'text/csv', text: 'code,title,status' };
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'code,title,status');
});
test('rejects invalid gids, login pages, outages and oversized sheets', async () => {
  assert.equal((await readSheet(new Request('https://example.test/api/sheet?gid=https://evil.test'))).status, 400);
  assert.equal((await readSheet(request, async () => ({ ok: true, status: 200, contentType: 'text/html', text: '<html>login</html>' }))).status, 502);
  assert.equal((await readSheet(request, async () => { throw new Error('offline'); })).status, 502);
  assert.equal((await readSheet(request, async () => ({ ok: true, status: 200, contentType: 'text/csv', text: 'x'.repeat(2097153) }))).status, 413);
});
