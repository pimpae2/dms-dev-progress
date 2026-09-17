import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = `${await readFile(new URL('../project-progress.js', import.meta.url), 'utf8')}\nglobalThis.parseProjectPlanForTest = parseProjectPlan;`;
const context = {
  DONE_STATUSES: new Set(['Developed', 'Tested']),
  document: { getElementById: () => null },
  console,
};
vm.runInNewContext(source, context);

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
