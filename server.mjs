import http from 'node:http';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const configPath = join(root, 'plan-settings.json');
const port = Number(process.env.PORT || 4175);
const defaultConfig = { revision: 0, plans: [{ id: 'org', name: 'โครงการ ORG', enabled: true, url: 'https://docs.google.com/spreadsheets/d/1vAv6UKV57NoRlDG5a0tL88AI0qfGIcDWr74FLOm8cfA/edit?gid=1021126458#gid=1021126458' }] };
let config;
try { config = JSON.parse(await readFile(configPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; config = defaultConfig; }
let saving = false;
const files = new Set(['index.html', 'project_plan.html', 'set_plan_sheet.html', 'styles.css', 'script.js', 'project-progress.js', 'plan-config.js', 'plan-settings.js']);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
function validatePlans(plans) {
  if (!Array.isArray(plans) || plans.length > 50) throw new Error('บันทึกได้สูงสุด 50 ชุดข้อมูล');
  const ids = new Set();
  return plans.map(plan => {
    if (typeof plan.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(plan.id) || ids.has(plan.id)) throw new Error('รหัสชุดข้อมูลซ้ำหรือไม่ถูกต้อง');
    ids.add(plan.id);
    if (typeof plan.name !== 'string' || !plan.name.trim() || plan.name.length > 100 || typeof plan.enabled !== 'boolean') throw new Error('ชื่อหรือสถานะชุดข้อมูลไม่ถูกต้อง');
    const url = new URL(plan.url);
    const match = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
    const gid = new URLSearchParams(url.hash.slice(1)).get('gid') || url.searchParams.get('gid');
    if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || url.username || url.password || !match || !/^\d+$/.test(gid || '')) throw new Error('ลิงก์ Google Sheets ไม่ถูกต้อง');
    return { id: plan.id, name: plan.name.trim(), enabled: plan.enabled, url: `https://docs.google.com/spreadsheets/d/${match[1]}/edit?gid=${gid}#gid=${gid}` };
  });
}
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/api/plans') {
      if (req.method === 'GET') return send(res, 200, config);
      if (req.method !== 'PUT') return send(res, 405, { error: 'Method not allowed' });
      if (req.headers.origin !== `http://${req.headers.host}` || !req.headers['content-type']?.startsWith('application/json')) return send(res, 403, { error: 'คำขอไม่ถูกต้อง' });
      let body = '';
      for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 65536) return send(res, 413, { error: 'ข้อมูลใหญ่เกินไป' }); }
      const input = JSON.parse(body);
      if (saving || input.revision !== config.revision) return send(res, 409, { error: 'มีการแก้ไขค่าตั้งค่าจากหน้าอื่น กรุณาโหลดรายการใหม่ก่อนบันทึก' });
      const next = { revision: config.revision + 1, plans: validatePlans(input.plans) };
      saving = true;
      try {
        const temp = `${configPath}.${randomUUID()}.tmp`;
        await writeFile(temp, JSON.stringify(next, null, 2), 'utf8');
        await rename(temp, configPath);
        config = next;
      } finally { saving = false; }
      return send(res, 200, config);
    }
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'Method not allowed' });
    if (['/project_plan_org', '/project_plan_org.html'].includes(url.pathname)) {
      res.writeHead(302, { Location: `/project_plan${url.search}` }); return res.end();
    }
    let file = url.pathname.slice(1) || 'index.html';
    if (['project_plan', 'set_plan_sheet'].includes(file)) file += '.html';
    if (!files.has(file)) return send(res, 404, { error: 'Not found' });
    const content = await readFile(join(root, file));
    res.writeHead(200, { 'Content-Type': mime[extname(file)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    send(res, error instanceof SyntaxError || error instanceof TypeError ? 400 : 500, { error: error.code ? 'ไม่สามารถอ่านหรือบันทึกไฟล์ได้' : error.message });
  }
}).listen(port, '127.0.0.1', () => console.log(`Project Progress: http://127.0.0.1:${port}/project_plan`));
