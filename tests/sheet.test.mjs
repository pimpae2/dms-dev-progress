import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSheet } from '../netlify/sheet-handler.mjs';
const request = new Request('https://example.test/api/sheet?id=abcdefghijk&gid=0');
test('reads CSV only from Google without credentials', async () => {
  const response = await readSheet(request, async (url, options) => {
    assert.equal(url, 'https://docs.google.com/spreadsheets/d/abcdefghijk/gviz/tq?tqx=out:csv&gid=0');
    assert.equal(options.headers, undefined);
    return new Response('code,title,status', { headers: { 'Content-Type': 'text/csv' } });
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'code,title,status');
});
test('rejects invalid IDs, login pages, outages and oversized sheets', async () => {
  assert.equal((await readSheet(new Request('https://example.test/api/sheet?id=https://evil.test&gid=0'))).status, 400);
  assert.equal((await readSheet(request, async () => new Response('<html>login</html>'))).status, 502);
  assert.equal((await readSheet(request, async () => { throw new Error('offline'); })).status, 502);
  assert.equal((await readSheet(request, async () => new Response('x'.repeat(2097153), { headers: { 'Content-Type': 'text/csv' } }))).status, 413);
});
