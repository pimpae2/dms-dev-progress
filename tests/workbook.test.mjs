import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkbookTabs, readWorkbook, PROJECT_WORKBOOK_ID } from '../netlify/workbook-handler.mjs';

const html = `<script>var items=[];
items.push({name: "Project Plan_ORG", pageUrl: "x", gid: "1021126458", initialSheet: true});
items.push({name: "Project Plan_DMS", pageUrl: "x", gid: "2001193771", initialSheet: false});
</script>`;

test('parses visible tabs in workbook order', () => {
  assert.deepEqual(parseWorkbookTabs(html), [
    { gid: '1021126458', name: 'Project Plan_ORG' },
    { gid: '2001193771', name: 'Project Plan_DMS' },
  ]);
});

test('returns workbook metadata from the fixed read-only source', async () => {
  const response = await readWorkbook(new Request('https://example.test/api/workbook'), async (url, options) => {
    assert.equal(url, `https://docs.google.com/spreadsheets/d/${PROJECT_WORKBOOK_ID}/htmlview`);
    assert.equal(options.headers.Accept, 'text/html');
    return new Response(html);
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).tabs.length, 2);
});

test('rejects writes and malformed metadata', async () => {
  assert.equal((await readWorkbook(new Request('https://example.test/api/workbook', { method: 'POST' }))).status, 405);
  assert.equal((await readWorkbook(new Request('https://example.test/api/workbook'), async () => new Response('<html></html>'))).status, 502);
});
