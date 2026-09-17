import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSheet } from '../netlify/sheet-handler.mjs';

const tabs = [{ name: 'องค์กรนายจ้าง', rows: [['#', 'หน้าจอ/เมนู/หัวข้อ', 'สถานะ'], ['1', 'งานแรก', 'Developed']] }];

test('reads a worksheet by its exact name', async () => {
  const request = new Request('https://example.test/api/sheet?name=%E0%B8%AD%E0%B8%87%E0%B8%84%E0%B9%8C%E0%B8%81%E0%B8%A3%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%88%E0%B9%89%E0%B8%B2%E0%B8%87');
  const response = await readSheet(request, async () => tabs);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), tabs[0]);
});

test('rejects missing names, unknown tabs, writes and source outages', async () => {
  assert.equal((await readSheet(new Request('https://example.test/api/sheet'), async () => tabs)).status, 400);
  assert.equal((await readSheet(new Request('https://example.test/api/sheet?name=missing'), async () => tabs)).status, 404);
  assert.equal((await readSheet(new Request('https://example.test/api/sheet?name=DMS', { method: 'POST' }), async () => tabs)).status, 405);
  assert.equal((await readSheet(new Request('https://example.test/api/sheet?name=DMS'), async () => { throw new Error('offline'); })).status, 502);
});
