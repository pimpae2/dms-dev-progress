import { PROJECT_WORKBOOK_ID } from './workbook-handler.mjs';

export async function readSheet(request, fetchImpl = fetch) {
  const json = (status, error) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'GET') return json(405, 'Method not allowed');
  const params = new URL(request.url).searchParams;
  const gid = params.get('gid') || '';
  if (!/^\d{1,20}$/.test(gid)) return json(400, 'รหัสแท็บไม่ถูกต้อง');
  try {
    // Never forward browser credentials or accept arbitrary upstream URLs.
    const response = await fetchImpl(`https://docs.google.com/spreadsheets/d/${PROJECT_WORKBOOK_ID}/gviz/tq?tqx=out:csv&gid=${gid}`, {
      headers: { Accept: 'text/csv' }, signal: AbortSignal.timeout(20000),
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/csv')) {
      return json(502, 'อ่านชีตไม่ได้ กรุณาตรวจลิงก์และสิทธิ์การอ่านชีตงาน');
    }
    const data = await response.text();
    if (new TextEncoder().encode(data).byteLength > 2 * 1024 * 1024) return json(413, 'ข้อมูลชีตใหญ่เกิน 2 MB');
    return new Response(data, { headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    console.error('Sheet proxy failed:', error?.name, error?.message);
    return json(502, 'เชื่อมต่อ Google Sheet ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }
}
