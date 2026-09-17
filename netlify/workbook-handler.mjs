import { loadProjectWorkbook, PROJECT_WORKBOOK_ID } from './workbook-source.mjs';

export { PROJECT_WORKBOOK_ID } from './workbook-source.mjs';

export async function readWorkbook(request, loadWorkbook = loadProjectWorkbook) {
  const json = (status, data) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const tabs = await loadWorkbook();
    return json(200, {
      spreadsheetId: PROJECT_WORKBOOK_ID,
      tabs: tabs.map(tab => ({ id: tab.name, name: tab.name })),
    });
  } catch (error) {
    console.error('Workbook metadata failed:', error?.name, error?.message);
    return json(502, { error: 'เชื่อมต่อรายการแท็บ Google Sheet ไม่สำเร็จ' });
  }
}
