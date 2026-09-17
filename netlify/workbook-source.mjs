import ExcelJS from 'exceljs';
import { readGoogleBuffer } from './google-read.mjs';

export const PROJECT_WORKBOOK_ID = '1Hi1M7GNhA5G2p7BgiGLH3F5A3aKgO2A-iU46XGOvFC8';
const SOURCE_URL = `https://docs.google.com/spreadsheets/d/${PROJECT_WORKBOOK_ID}/export?format=xlsx`;
const CACHE_MS = 60_000;
const MAX_TABS = 100;
const MAX_CELLS_PER_TAB = 100_000;

let cached = null;
let pending = null;

function cellText(cell) {
  if (cell.value == null) return '';
  return String(cell.text ?? cell.value).trim();
}

export async function parseWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (!workbook.worksheets.length) throw new Error('No visible workbook tabs');
  if (workbook.worksheets.length > MAX_TABS) throw new Error('Workbook has too many tabs');
  return workbook.worksheets.map(worksheet => {
    const rowCount = worksheet.actualRowCount;
    const columnCount = worksheet.actualColumnCount;
    if (rowCount * columnCount > MAX_CELLS_PER_TAB) throw new Error(`Worksheet too large: ${worksheet.name}`);
    const rows = [];
    for (let rowNumber = 1; rowNumber <= rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const values = [];
      for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
        values.push(cellText(row.getCell(columnNumber)));
      }
      rows.push(values);
    }
    return { name: worksheet.name, rows };
  });
}

export async function loadProjectWorkbook(readBuffer = readGoogleBuffer, now = Date.now()) {
  if (cached && cached.expiresAt > now) return cached.tabs;
  if (pending) return pending;
  pending = (async () => {
    const response = await readBuffer(SOURCE_URL, {
      accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      maxBytes: 10 * 1024 * 1024,
    });
    if (!response.ok) throw new Error(`Google workbook returned ${response.status}`);
    const tabs = await parseWorkbook(response.buffer);
    cached = { expiresAt: Date.now() + CACHE_MS, tabs };
    return tabs;
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}

export function clearWorkbookCache() {
  cached = null;
  pending = null;
}
