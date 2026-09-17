import { readGoogleText } from './google-read.mjs';

export const PROJECT_WORKBOOK_ID = '1Hi1M7GNhA5G2p7BgiGLH3F5A3aKgO2A-iU46XGOvFC8';

function decodeGoogleString(value) {
  return JSON.parse(`"${value}"`);
}

export function parseWorkbookTabs(html) {
  const tabs = [];
  const pattern = /items\.push\(\{name:\s*"((?:\\.|[^"\\])*)",[\s\S]*?gid:\s*"(-?\d+)"/g;
  for (const match of html.matchAll(pattern)) {
    const name = decodeGoogleString(match[1]);
    if (!tabs.some(tab => tab.gid === match[2])) tabs.push({ gid: match[2], name });
  }
  if (!tabs.length) throw new Error('No visible workbook tabs');
  return tabs;
}

export async function readWorkbook(request, readText = readGoogleText) {
  const json = (status, data) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const response = await readText(`https://docs.google.com/spreadsheets/d/${PROJECT_WORKBOOK_ID}/htmlview`, { accept: 'text/html' });
    if (!response.ok) return json(502, { error: 'อ่านรายชื่อแท็บไม่ได้ กรุณาตรวจสิทธิ์ของ Google Sheet' });
    return json(200, { spreadsheetId: PROJECT_WORKBOOK_ID, tabs: parseWorkbookTabs(response.text) });
  } catch (error) {
    console.error('Workbook metadata failed:', error?.name, error?.message);
    return json(502, { error: 'เชื่อมต่อรายการแท็บ Google Sheet ไม่สำเร็จ' });
  }
}
