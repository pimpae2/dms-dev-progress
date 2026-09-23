import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4175);
const files = new Set(['index.html', 'home.html', 'styles.css', 'script.js', 'project-progress.js', 'uat-history-seed.json']);
const mime = { '.json': 'application/json; charset=utf-8', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'Method not allowed' });
    if (['/project_plan', '/project_plan.html', '/project_plan_org', '/project_plan_org.html', '/set_plan_sheet'].includes(url.pathname)) {
      res.writeHead(302, { Location: `/${url.search}` }); return res.end();
    }
    let file = url.pathname.slice(1) || 'index.html';
    if (file === 'home') file = 'home.html';
    if (!files.has(file)) return send(res, 404, { error: 'Not found' });
    const content = await readFile(join(root, file));
    res.writeHead(200, { 'Content-Type': mime[extname(file)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    send(res, error instanceof SyntaxError || error instanceof TypeError ? 400 : 500, { error: error.code ? 'ไม่สามารถอ่านหรือบันทึกไฟล์ได้' : error.message });
  }
}).listen(port, '127.0.0.1', () => console.log(`Project Progress: http://127.0.0.1:${port}/`));
