import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = `${await readFile(new URL('../project-progress.js', import.meta.url), 'utf8')}\nglobalThis.parseProjectPlanForTest = parseProjectPlan; globalThis.parseWorkbookTabsForTest = parseWorkbookTabsHtml; globalThis.combineDashboardSystemsForTest = combineDashboardSystems;`;
const context = {
  DONE_STATUSES: new Set(['Developed', 'Tested']),
  document: { getElementById: () => null },
  console,
};
vm.runInNewContext(source, context);

test('discovers all workbook tabs in their displayed order', () => {
  const result = context.parseWorkbookTabsForTest(`<script>
    items.push({name: "องค์กรนายจ้าง", pageUrl: "x", gid: "1021126458"});
    items.push({name: "DMS", pageUrl: "x", gid: "2001193771"});
  </script>`);
  assert.deepEqual(Array.from(result, tab => tab.name), ['องค์กรนายจ้าง', 'DMS']);
  assert.deepEqual(Array.from(result, tab => tab.gid), ['1021126458', '2001193771']);
});

test('parses hierarchical project tabs', () => {
  const result = context.parseProjectPlanForTest([
    ['', 'หน้าจอ/เมนู/หัวข้อ', 'สถานะ'],
    ['1.1', 'ระบบองค์กรนายจ้าง', ''],
    ['1.1.1', 'งาน A', 'Developed'],
    ['1.1.2', 'งาน B', 'To Do'],
  ], 'ORG');
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'ระบบองค์กรนายจ้าง');
  assert.equal(result[0].total, 2);
  assert.equal(result[0].done, 1);
});

test('parses flat project tabs as a single project group', () => {
  const result = context.parseProjectPlanForTest([
    ['#', 'หน้าจอ/เมนู/หัวข้อ', 'สถานะ'],
    ['1', 'งาน A', 'Tested'],
    ['2', 'งาน B', 'Fixing / Rework'],
    ['3', 'ไม่มีสถานะ', ''],
  ], 'DMS');
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'DMS');
  assert.equal(result[0].total, 2);
  assert.equal(result[0].done, 1);
});

test('keeps empty project tabs available without an error', () => {
  assert.equal(context.parseProjectPlanForTest([], 'EMPTY').length, 0);
  assert.equal(context.parseProjectPlanForTest([
    ['#', 'หน้าจอ/เมนู/หัวข้อ', 'สถานะ'],
  ], 'EMPTY').length, 0);
});

test('combines systems from every populated project tab', () => {
  const result = context.combineDashboardSystemsForTest([
    { plan: { displayName: 'ORG' }, systems: [{ name: 'ระบบนายจ้าง', slug: 'plan-group-0', total: 2, done: 1, items: [] }] },
    { plan: { displayName: 'DMS' }, systems: [{ name: 'DMS', slug: 'plan-group-0', total: 3, done: 2, items: [] }] },
    { plan: { displayName: 'EMPTY' }, systems: [] },
  ]);
  assert.equal(result.length, 3);
  assert.equal(result[0].name, 'ORG');
  assert.equal(result[0].total, 2);
  assert.equal(result[0].done, 1);
  assert.equal(result[1].name, 'DMS');
  assert.equal(result[2].name, 'EMPTY');
  assert.equal(result[2].total, 0);
  assert.notEqual(result[0].slug, result[1].slug);
});
