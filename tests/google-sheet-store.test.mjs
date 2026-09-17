import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleSheetStore } from '../netlify/google-sheet-store.mjs';
import { createPlansHandler } from '../netlify/plans-handler.mjs';

const url = 'https://script.google.com/macros/s/test/exec';
test('adapter sends server token and propagates the sheet revision after saving', async () => {
  const calls = [];
  const store = createGoogleSheetStore({ url, token: 'server-secret', fetchImpl: async (endpoint, options) => {
    assert.equal(endpoint.href, url);
    const payload = JSON.parse(options.body);
    calls.push(payload);
    return Response.json(payload.action === 'read'
      ? { ok: true, data: { revision: 'before', plans: [] } }
      : { ok: true, modified: true, data: { revision: 'after', plans: [] } });
  } });
  const handler = createPlansHandler({ store, secret: 'admin' });
  const response = await handler(new Request('https://example.test/api/plans', {
    method: 'PUT', headers: { Authorization: 'Bearer admin', Origin: 'https://example.test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: 'before', plans: [] }),
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).revision, 'after');
  assert.equal(calls[1].revision, 'before');
  assert.equal(calls[1].token, 'server-secret');
});
test('adapter rejects missing credentials, wrong endpoint, and upstream failure', async () => {
  await assert.rejects(createGoogleSheetStore({ url }).getWithMetadata());
  await assert.rejects(createGoogleSheetStore({ url: 'https://evil.test', token: 'secret' }).getWithMetadata());
  await assert.rejects(createGoogleSheetStore({ url, token: 'secret', fetchImpl: async () => Response.json({ ok: false }) }).getWithMetadata());
});
