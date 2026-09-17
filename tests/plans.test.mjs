import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlansHandler } from '../netlify/plans-handler.mjs';

const plan = { id: 'org', name: 'ORG', enabled: true, url: 'https://docs.google.com/spreadsheets/d/example/edit?gid=0#gid=0' };
const seed = { revision: 0, plans: [plan, { ...plan, id: 'hidden', enabled: false }] };
function fixture(secret = 'test-secret') {
  let saved = null;
  const store = {
    async getWithMetadata() { return saved && structuredClone(saved); },
    async setJSON(key, data, options) {
      if (options.onlyIfNew ? saved !== null : options.onlyIfMatch !== saved?.etag) return { modified: false };
      saved = { data, etag: String(data.revision) };
      return { modified: true };
    },
  };
  return { store, handler: createPlansHandler({ store, secret, seed }) };
}
function request(method = 'GET', body, token, origin = 'https://example.netlify.app') {
  return new Request('https://example.netlify.app/api/plans', {
    method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test('public reading hides disabled sources; admin can read all', async () => {
  const { handler } = fixture();
  const publicData = await (await handler(request())).json();
  assert.equal(publicData.plans.length, 1);
  assert.equal(publicData.requiresAuth, true);
  assert.equal((await (await handler(request('GET', undefined, 'test-secret'))).json()).plans.length, 2);
  assert.equal((await handler(request('GET', undefined, 'wrong'))).status, 401);
});
test('write protection and validation', async () => {
  const { handler } = fixture();
  const body = { revision: 0, plans: [plan] };
  assert.equal((await handler(request('PUT', body))).status, 401);
  assert.equal((await handler(request('PUT', body, 'test-secret', 'https://evil.test'))).status, 403);
  assert.equal((await handler(request('PUT', { ...body, plans: [{ ...plan, url: 'https://evil.test' }] }, 'test-secret'))).status, 400);
  assert.equal((await handler(request('PUT', { ...body, plans: [plan, plan] }, 'test-secret'))).status, 400);
  assert.equal((await handler(request('PUT', { padding: 'x'.repeat(66000) }, 'test-secret'))).status, 413);
  assert.equal((await fixture('').handler(request('PUT', body))).status, 503);
});
test('saved data survives handler recreation; stale and concurrent writes conflict', async () => {
  const { handler, store } = fixture();
  const body = { revision: 0, plans: [{ ...plan, name: 'Updated' }] };
  const results = await Promise.all([handler(request('PUT', body, 'test-secret')), handler(request('PUT', body, 'test-secret'))]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  const recreated = createPlansHandler({ store, secret: 'test-secret', seed });
  const saved = await (await recreated(request())).json();
  assert.equal(saved.plans[0].name, 'Updated');
  assert.equal(saved.revision, 1);
  assert.equal((await recreated(request('PUT', body, 'test-secret'))).status, 409);
  assert.equal((await recreated(request('PUT', { revision: 1, plans: [] }, 'test-secret'))).status, 200);
  assert.deepEqual((await (await recreated(request())).json()).plans, []);
});
