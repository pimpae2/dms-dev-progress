import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = `${await readFile(new URL('../project-progress.js', import.meta.url), 'utf8')}\nglobalThis.parseProjectPlanForTest = parseProjectPlan; globalThis.parseWorkbookTabsForTest = parseWorkbookTabsHtml; globalThis.combineDashboardSystemsForTest = combineDashboardSystems;`;
const context = {
  DONE_STATUSES: new Set(['Developed', 'Tested', 'Completed']),
  document: { getElementById: () => null },
  console,
};
vm.runInNewContext(source, context);

test('LES text section headings retain ownership and empty sections without counting blank statuses', () => {
  const result = context.parseProjectPlanForTest([
    ['', 'หน้าจอ/เมนู/หัวข้อ', 'สถานะ'],
    ['กองทุน', '', ''],
    ['1', 'Fund task', 'Completed'],
    ['ทนายความ', '', ''],
    ['2', 'Lawyer task', 'In Progress'],
    ['3', 'Blank status task', ''],
    ['การเงิน', '', ''],
    ['4', 'Finance task', ''],
  ], 'LES');
  assert.deepEqual(Array.from(result, g => [g.name, g.total, g.done]), [['กองทุน', 1, 1], ['ทนายความ', 1, 0], ['การเงิน', 0, 0]]);
});

test('LOS invisible characters in numeric codes do not drop tasks', () => {
  const result = context.parseProjectPlanForTest([
    ['', 'หน้าจอ/เมนู/หัวข้อ', 'สถานะ'],
    ['3', 'Section', ''],
    ['3.1\u200b0', 'เงินอุดหนุน', 'In Progress'],
  ], 'LOS');
  assert.equal(result[0].total, 1);
  assert.equal(result[0].items[0].code, '3.10');
});

test('UAT uses its own status column even when introductory text mentions statuses', () => {
  const result = context.parseEnvironmentPlan([
    ['UAT plan สถานะ UAT เริ่ม UNTESTED'],
    ['รหัสงาน UAT', 'เครื่อง UAT', 'IP', 'ขั้นตอน', 'รายการติดตั้ง / Config', 'เกณฑ์ตรวจรับ', 'อ้างอิง DEV', 'สถานะ DEV ต้นทาง', 'สถานะ UAT'],
    ['UAT-01', 'uat', '', 'Config', 'Task A', '', '', 'PASS', 'UNTESTED'],
    ['UAT-02', 'uat', '', 'Config', 'Task B', '', '', 'PENDING', 'PASS'],
  ], { kind: 'environment-uat' });
  assert.equal(result[0].total, 2);
  assert.equal(result[0].done, 1);
  assert.equal(result[0].items[0].status, 'UNTESTED');
  assert.equal(result[0].items[1].status, 'PASS');
});

test('UAT resolves reordered columns by exact header name', () => {
  const result = context.parseEnvironmentPlan([
    ['สถานะ DEV ต้นทาง', 'สถานะ UAT', 'เครื่อง UAT', 'รายการติดตั้ง / Config', 'รหัสงาน UAT'],
    ['PASS', 'BLOCKED', 'uat', 'Task', 'UAT-01'],
  ], { kind: 'environment-uat' });
  assert.equal(result[0].done, 0);
  assert.equal(result[0].items[0].status, 'BLOCKED');
});

test('Dev progress uses current task statuses rather than stale summary totals', () => {
  const result = context.parseEnvironmentPlan([
    ['บทบาท', 'เครื่อง', 'รวม ผ่าน/ทั้งหมด'],
    ['VM-01', 'dev', '0/2'],
    ['ภาพรวม', '', '0/2'],
    ['รหัสงาน', 'เครื่อง', 'ขั้นตอน', 'งาน', 'สถานะล่าสุด'],
    ['D-01', 'dev', 'Config', 'Task A', 'PASS'],
    ['D-02', 'dev', 'Config', 'Task B', 'BLOCKED'],
  ], { kind: 'environment-dev' });
  assert.equal(result[0].total, 2);
  assert.equal(result[0].done, 1);
});

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

test('parses AIM tabs with descriptive header suffixes', () => {
  const result = context.parseProjectPlanForTest([
    ['', '', 'หน้าจอ/เมนู/หัวข้อ Portal หน้าแรก', 'สถานะ Completed'],
    ['1', '', 'จัดการหน้าจอระบบ', ''],
    ['1.1', '', 'Master Control System', 'In Progress'],
    ['1.2', '', 'ระบบ Gateway', 'Completed'],
    ['2', '', 'จัดการข้อความแจ้งเตือน', ''],
    ['2.1', '', 'Info Message', 'In Progress'],
    ['3', '', 'จัดการผู้ใช้งานและสิทธิ์ภายใน', ''],
    ['3.1', '', 'จัดการ User', 'Completed'],
  ], 'AIM');
  assert.equal(result.length, 3);
  assert.equal(result[0].name, 'จัดการหน้าจอระบบ');
  assert.equal(result[0].total, 2);
  assert.equal(result[0].done, 1);
  assert.equal(Array.from(result, (system) => system.name).join('|'), 'จัดการหน้าจอระบบ|จัดการข้อความแจ้งเตือน|จัดการผู้ใช้งานและสิทธิ์ภายใน');
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
