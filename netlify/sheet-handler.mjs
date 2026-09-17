import { loadProjectWorkbook } from './workbook-source.mjs';

export async function readSheet(request, loadWorkbook = loadProjectWorkbook) {
  const json = (status, data) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed' });
  const name = new URL(request.url).searchParams.get('name')?.trim() || '';
  if (!name || name.length > 100) return json(400, { error: 'ชื่อแท็บไม่ถูกต้อง' });
  try {
    const tabs = await loadWorkbook();
    const tab = tabs.find(item => item.name === name);
    if (!tab) return json(404, { error: 'ไม่พบแท็บนี้ใน Google Sheet' });
    return json(200, { name: tab.name, rows: tab.rows });
  } catch (error) {
    console.error('Sheet read failed:', error?.name, error?.message);
    return json(502, { error: 'เชื่อมต่อ Google Sheet ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
  }
}
