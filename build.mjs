import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const output = new URL('./dist/', root);
const files = ['index.html', 'project_plan.html', 'set_plan_sheet.html', 'styles.css', 'script.js', 'project-progress.js', 'plan-config.js', 'plan-settings.js', '_redirects'];
let config;
try { config = JSON.parse(await readFile(new URL('plan-settings.json', root), 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  config = JSON.parse(await readFile(new URL('plans-public.json', root), 'utf8'));
}
if (!Array.isArray(config.plans)) throw new Error('Invalid plan configuration');
const plans = config.plans.filter(plan => plan.enabled).map(({ id, name, url, enabled }) => ({ id, name, url, enabled }));
await mkdir(output, { recursive: true });
await Promise.all(files.map(file => copyFile(new URL(file, root), new URL(file, output))));
await writeFile(new URL('plans-public.json', output), JSON.stringify({ revision: config.revision, plans }, null, 2));
console.log(`Built dist: ${plans.length} enabled plan(s). Local server and private settings excluded.`);
