const UAT_SOURCE_ID = '1Zf9Ud4pIf_XvL2U-1jzyLkRB5YwEKcwwlipQNfvv8SM';
const UAT_SOURCE_GID = 209210002;
const HISTORY_HEADERS = ['captured_at', 'date', 'code', 'machine', 'title', 'status'];

function setupUatHistory() {
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('UAT_HISTORY_ID')) {
    // Verify source access before creating the destination.
    readUatTasks();
    const book = SpreadsheetApp.create('UAT Progress History');
    book.setSpreadsheetTimeZone('Asia/Bangkok');
    const sheet = book.getSheets()[0];
    sheet.setName('UAT-History');
    sheet.appendRow(HISTORY_HEADERS);
    sheet.setFrozenRows(1);
    properties.setProperty('UAT_HISTORY_ID', book.getId());
  }
  captureUatHistory();
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'captureUatHistory')) {
    ScriptApp.newTrigger('captureUatHistory').timeBased().everyHours(1).create();
  }
  console.log('History: https://docs.google.com/spreadsheets/d/' + properties.getProperty('UAT_HISTORY_ID') + '/edit');
}

function readUatTasks() {
  const source = SpreadsheetApp.openById(UAT_SOURCE_ID).getSheets().find(s => s.getSheetId() === UAT_SOURCE_GID);
  if (!source) throw new Error('UAT source tab not found');
  const rows = source.getDataRange().getDisplayValues();
  const headerRow = rows.findIndex(r => r.includes('รหัสงาน UAT') && r.includes('สถานะ UAT'));
  if (headerRow < 0) throw new Error('UAT headers not found');
  const header = rows[headerRow];
  const names = ['รหัสงาน UAT', 'เครื่อง UAT', 'รายการติดตั้ง / Config', 'สถานะ UAT'];
  const columns = names.map(n => header.indexOf(n));
  if (columns.some(i => i < 0)) throw new Error('Required UAT column missing');
  const tasks = rows.slice(headerRow + 1).map(r => columns.map(i => r[i].trim())).filter(r => r[0] && r[3]);
  if (!tasks.length || new Set(tasks.map(r => r[0])).size !== tasks.length) throw new Error('Empty UAT data or duplicate task codes');
  return tasks;
}

function captureUatHistory() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const id = PropertiesService.getScriptProperties().getProperty('UAT_HISTORY_ID');
    if (!id) throw new Error('Run setupUatHistory first');
    const tasks = readUatTasks();
    const now = new Date();
    const timestamp = now.toISOString();
    const date = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');
    const sheet = SpreadsheetApp.openById(id).getSheetByName('UAT-History');
    if (!sheet) throw new Error('History tab missing');
    // Store external strings as literal text, never spreadsheet formulas.
    const literal = value => /^[=+@-]/.test(value) ? "'" + value : value;
    const rows = tasks.map(task => [timestamp, date, ...task.map(literal)]);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HISTORY_HEADERS.length).setNumberFormat('@').setValues(rows);
  } finally {
    lock.releaseLock();
  }
}
