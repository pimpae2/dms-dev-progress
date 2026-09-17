import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { readWorkbook, PROJECT_WORKBOOK_ID } from '../netlify/workbook-handler.mjs';
import { parseWorkbook } from '../netlify/workbook-source.mjs';

test('parses every worksheet and keeps workbook order', async () => {
  const source = new ExcelJS.Workbook();
  source.addWorksheet('องค์กรนายจ้าง').addRows([['#', 'หน้าจอ/เมนู/หัวข้อ', 'สถานะ'], ['1', 'งานแรก', 'Developed']]);
  source.addWorksheet('DMS').addRows([['#', 'หน้าจอ/เมนู/หัวข้อ', 'สถานะ'], ['1', 'งานสอง', 'To Do']]);
  const tabs = await parseWorkbook(await source.xlsx.writeBuffer());
  assert.deepEqual(tabs.map(tab => tab.name), ['องค์กรนายจ้าง', 'DMS']);
  assert.equal(tabs[0].rows[1][1], 'งานแรก');
});

test('returns tab names from the fixed read-only workbook', async () => {
  const response = await readWorkbook(new Request('https://example.test/api/workbook'), async () => [
    { name: 'องค์กรนายจ้าง', rows: [] },
    { name: 'DMS', rows: [] },
  ]);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    spreadsheetId: PROJECT_WORKBOOK_ID,
    tabs: [{ id: 'องค์กรนายจ้าง', name: 'องค์กรนายจ้าง' }, { id: 'DMS', name: 'DMS' }],
  });
});

test('rejects writes and reports source failures', async () => {
  assert.equal((await readWorkbook(new Request('https://example.test/api/workbook', { method: 'POST' }))).status, 405);
  assert.equal((await readWorkbook(new Request('https://example.test/api/workbook'), async () => { throw new Error('offline'); })).status, 502);
});
