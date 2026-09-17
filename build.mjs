import { mkdir, copyFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const output = new URL('./dist/', root);
const files = ['index.html', 'home.html', 'styles.css', 'script.js', 'project-progress.js', '_redirects'];
await mkdir(output, { recursive: true });
await Promise.all(files.map(file => copyFile(new URL(file, root), new URL(file, output))));
console.log('Built dist: Project Progress at / and DEV/document dashboard at /home.');
