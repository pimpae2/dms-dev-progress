// Deploy as a Web App executing as the sheet owner. Keep API_TOKEN in Script Properties.
const SETTINGS_SHEET_ID = '14kRX-Z-YIEWG-EG71wOpyUIR8YlbkXLOHySqd10IyaY';
const SETTINGS_TAB_ID = 0;
const SETTINGS_HEADERS = ['id', 'name', 'url', 'enabled', 'order', 'updated_at'];

function doPost(event) {
  let lock;
  try {
    const input = JSON.parse(event.postData.contents);
    const token = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
    if (!token || input.token !== token) return settingsResponse({ ok: false, error: 'Unauthorized' });
    if (!['read', 'save'].includes(input.action)) throw new Error('Invalid action');
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.openById(SETTINGS_SHEET_ID).getSheets().find(s => s.getSheetId() === SETTINGS_TAB_ID);
    if (!sheet) throw new Error('Target tab not found');
    const snapshot = readSettings(sheet);
    if (input.action === 'read') return settingsResponse({ ok: true, data: snapshot.data });
    if (input.revision !== snapshot.data.revision) return settingsResponse({ ok: true, modified: false });
    const plans = validateSettingsPlans(input.plans);
    const timestamp = new Date().toISOString();
    // Write only C:H. Padding removes deleted records without clearing A:B or other columns.
    const rows = [SETTINGS_HEADERS].concat(plans.map((plan, index) => [
      plan.id, literalCell(plan.name), plan.url, plan.enabled, index + 1, timestamp,
    ]));
    while (rows.length < snapshot.rowCount) rows.push(['', '', '', '', '', '']);
    sheet.getRange(1, 3, rows.length, 6).setValues(rows);
    SpreadsheetApp.flush();
    return settingsResponse({ ok: true, modified: true, data: readSettings(sheet).data });
  } catch (error) {
    console.error(error.message);
    return settingsResponse({ ok: false, error: 'Cannot read or save settings; inspect Apps Script execution logs' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function literalCell(value) {
  return /^[=+@-]/.test(value) ? "'" + value : value;
}

function readSettings(sheet) {
  // A 50-source limit bounds reads even when unrelated columns contain many rows.
  const range = sheet.getRange(1, 3, Math.min(sheet.getMaxRows(), 52), 6);
  const rows = range.getValues();
  if (range.getFormulas().some(row => row.some(Boolean))) throw new Error('C:H contains formulas; refusing to overwrite');
  while (rows.length && rows[rows.length - 1].every(value => value === '')) rows.pop();
  if (!rows.length) return { rowCount: 0, data: { revision: settingsRevision([]), plans: [] } };
  if (!SETTINGS_HEADERS.every((header, index) => rows[0][index] === header)) throw new Error('C1:H1 must match settings headers; existing data left untouched');
  if (rows.length > 51) throw new Error('More than 50 sources or unrelated data in C:H');
  const entries = rows.slice(1).filter(row => row.some(value => value !== '')).map(row => {
    if (!(typeof row[3] === 'boolean' || ['TRUE', 'FALSE'].includes(String(row[3]).toUpperCase()))) throw new Error('Invalid enabled value');
    if (!Number.isInteger(Number(row[4])) || Number(row[4]) < 1) throw new Error('Invalid order');
    return { id: String(row[0]), name: String(row[1]), url: String(row[2]), enabled: String(row[3]).toUpperCase() === 'TRUE', order: Number(row[4]) };
  });
  entries.sort((a, b) => a.order - b.order);
  const plans = validateSettingsPlans(entries);
  return { rowCount: rows.length, data: { revision: settingsRevision(rows), plans } };
}

function validateSettingsPlans(plans) {
  if (!Array.isArray(plans) || plans.length > 50) throw new Error('Invalid source count');
  const ids = new Set();
  return plans.map(plan => {
    if (!plan || typeof plan.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(plan.id) || ids.has(plan.id)) throw new Error('Invalid or duplicate ID');
    ids.add(plan.id);
    if (typeof plan.name !== 'string' || !plan.name.trim() || plan.name.length > 100 || typeof plan.enabled !== 'boolean') throw new Error('Invalid source');
    if (typeof plan.url !== 'string' || !/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+\/edit\?gid=\d+#gid=\d+$/.test(plan.url)) throw new Error('Invalid sheet URL');
    return { id: plan.id, name: plan.name.trim(), url: plan.url, enabled: plan.enabled };
  });
}

function settingsRevision(rows) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(rows)));
}

function settingsResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
