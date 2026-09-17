import https from 'node:https';
import { Buffer } from 'node:buffer';

function isAllowedGoogleHost(hostname) {
  return hostname === 'docs.google.com' || hostname.endsWith('.googleusercontent.com');
}

export function readGoogleBuffer(rawUrl, { accept, maxBytes = 10 * 1024 * 1024, redirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || !isAllowedGoogleHost(url.hostname)) return reject(new Error('Blocked Google host'));
    const request = https.get(url, {
      headers: { Accept: accept || '*/*', 'User-Agent': 'DMS-Project-Progress/1.0' },
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        if (redirects >= 3) return reject(new Error('Too many Google redirects'));
        return resolve(readGoogleBuffer(new URL(response.headers.location, url).href, { accept, maxBytes, redirects: redirects + 1 }));
      }
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) response.destroy(new Error('Google response too large'));
        else chunks.push(chunk);
      });
      response.on('end', () => resolve({
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode || 0,
        contentType: String(response.headers['content-type'] || ''),
        buffer: Buffer.concat(chunks),
      }));
    });
    request.setTimeout(25000, () => request.destroy(new Error('Google request timed out')));
    request.on('error', reject);
  });
}
