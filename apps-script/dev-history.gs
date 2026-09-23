const DEV_SOURCE_ID = '1Zf9Ud4pIf_XvL2U-1jzyLkRB5YwEKcwwlipQNfvv8SM';
const DEV_SOURCE_GID = 0;
const DEV_HISTORY_HEADERS = ['captured_at', 'date', 'code', 'machine', 'title', 'status'];

function setupDevHistory() {
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('DEV_HISTORY_ID')) {
    readDevTasks();
    const book = SpreadsheetApp.create('DEV Progress History');
    book.setSpreadsheetTimeZone('Asia/Bangkok');
    const sheet = book.getSheets()[0];
    sheet.setName('DEV-History');
    sheet.appendRow(DEV_HISTORY_HEADERS);
    sheet.setFrozenRows(1);
    properties.setProperty('DEV_HISTORY_ID', book.getId());
  }
  captureDevHistory();
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'captureDevHistory')) {
    ScriptApp.newTrigger('captureDevHistory').timeBased().everyHours(1).create();
  }
  console.log('History: https://docs.google.com/spreadsheets/d/' + properties.getProperty('DEV_HISTORY_ID') + '/edit');
}

function readDevTasks() {
  const source = SpreadsheetApp.openById(DEV_SOURCE_ID).getSheets().find(s => s.getSheetId() === DEV_SOURCE_GID);
  if (!source) throw new Error('DEV source tab not found');
  const rows = source.getDataRange().getDisplayValues();
  const headerRow = rows.findIndex(r => r.includes('รหัสงาน') && r.includes('สถานะล่าสุด'));
  if (headerRow < 0) throw new Error('DEV headers not found');
  const header = rows[headerRow];
  const columns = ['รหัสงาน', 'เครื่อง', 'งาน', 'สถานะล่าสุด'].map(n => header.indexOf(n));
  if (columns.some(i => i < 0)) throw new Error('Required DEV column missing');
  const criteria = header.indexOf('เกณฑ์ผ่าน');
  const tasks = rows.slice(headerRow + 1).map(r => {
    const task = columns.map(i => String(r[i] || '').trim());
    task[1] = task[1] || 'ไม่ระบุเครื่อง';
    task[2] = task[2] || String(r[criteria] || '').trim();
    return task;
  }).filter(r => r[0] && r[3]);
  if (!tasks.length || new Set(tasks.map(r => r[0])).size !== tasks.length) throw new Error('Empty DEV data or duplicate task codes');
  return tasks;
}

function captureDevHistory() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const id = PropertiesService.getScriptProperties().getProperty('DEV_HISTORY_ID');
    if (!id) throw new Error('Run setupDevHistory first');
    const tasks = readDevTasks();
    const now = new Date();
    const timestamp = now.toISOString();
    const date = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');
    const sheet = SpreadsheetApp.openById(id).getSheetByName('DEV-History');
    if (!sheet) throw new Error('DEV history tab missing');
    // Keep external strings as text, never formulas.
    const literal = value => /^[=+@-]/.test(value) ? "'" + value : value;
    const rows = tasks.map(task => [timestamp, date, ...task.map(literal)]);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, DEV_HISTORY_HEADERS.length).setNumberFormat('@').setValues(rows);
  } finally {
    lock.releaseLock();
  }
}
