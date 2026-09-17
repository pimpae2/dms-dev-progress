import { createHash, timingSafeEqual } from 'node:crypto';

function validatePlans(plans) {
  if (!Array.isArray(plans) || plans.length > 50) throw new Error('บันทึกได้สูงสุด 50 ชุดข้อมูล');
  const ids = new Set();
  return plans.map(plan => {
    if (!plan || typeof plan.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(plan.id) || ids.has(plan.id)) throw new Error('รหัสชุดข้อมูลซ้ำหรือไม่ถูกต้อง');
    ids.add(plan.id);
    if (typeof plan.name !== 'string' || !plan.name.trim() || plan.name.length > 100 || typeof plan.enabled !== 'boolean') throw new Error('ชื่อหรือสถานะไม่ถูกต้อง');
    const url = new URL(plan.url);
    const match = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
    const gid = new URLSearchParams(url.hash.slice(1)).get('gid') || url.searchParams.get('gid');
    if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || url.port || url.username || url.password || !match || !/^\d+$/.test(gid || '')) throw new Error('ลิงก์ Google Sheets ไม่ถูกต้อง');
    return { id: plan.id, name: plan.name.trim(), enabled: plan.enabled, url: `https://docs.google.com/spreadsheets/d/${match[1]}/edit?gid=${gid}#gid=${gid}` };
  });
}

const json = (status, data) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const digest = value => createHash('sha256').update(value).digest();

export function createPlansHandler({ store, secret, seed }) {
  return async request => {
    try {
      if (!['GET', 'PUT'].includes(request.method)) return json(405, { error: 'Method not allowed' });
      const supplied = request.headers.get('authorization');
      const authenticated = Boolean(secret && supplied && timingSafeEqual(digest(supplied), digest(`Bearer ${secret}`)));
      if (supplied && !authenticated) return json(401, { error: 'รหัสผู้ดูแลไม่ถูกต้อง' });
      if (request.method === 'PUT') {
        if (!secret) return json(503, { error: 'กรุณาตั้งค่า PLAN_ADMIN_TOKEN บน Netlify แล้ว Deploy ใหม่' });
        if (!authenticated) return json(401, { error: 'กรุณาใส่รหัสผู้ดูแลก่อนบันทึก' });
        if (request.headers.get('origin') !== new URL(request.url).origin) return json(403, { error: 'คำขอไม่ถูกต้อง' });
        if (!request.headers.get('content-type')?.startsWith('application/json')) return json(415, { error: 'ต้องเป็นข้อมูล JSON' });
      }
      const stored = await store.getWithMetadata('config', { type: 'json' });
      const current = stored?.data || seed;
      if (request.method === 'GET') return json(200, {
        revision: current.revision,
        plans: authenticated ? current.plans : current.plans.filter(plan => plan.enabled),
        readOnly: !authenticated, requiresAuth: Boolean(secret) && !authenticated,
        setupRequired: !secret,
      });
      const reader = request.body?.getReader();
      let size = 0;
      const chunks = [];
      if (reader) for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65536) { await reader.cancel(); return json(413, { error: 'ข้อมูลใหญ่เกินไป' }); }
        chunks.push(value);
      }
      let input;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return json(400, { error: 'ข้อมูล JSON ไม่ถูกต้อง' }); }
      if (!input || input.revision !== current.revision) return json(409, { error: 'มีการแก้ไขจากหน้าอื่น กรุณาโหลดหน้าใหม่ก่อนบันทึก' });
      let plans;
      try { plans = validatePlans(input.plans); }
      catch (error) { return json(400, { error: error.message }); }
      const next = { revision: current.revision + 1, plans };
      // Conditional replacement prevents a stale settings page overwriting another save.
      const result = await store.setJSON('config', next, stored ? { onlyIfMatch: stored.etag } : { onlyIfNew: true });
      if (!result.modified) return json(409, { error: 'มีการแก้ไขจากหน้าอื่น กรุณาโหลดหน้าใหม่ก่อนบันทึก' });
      return json(200, next);
    } catch {
      return json(503, { error: 'บริการจัดเก็บไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง' });
    }
  };
}
