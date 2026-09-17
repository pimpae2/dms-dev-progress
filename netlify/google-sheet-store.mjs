// Only the server knows the Apps Script endpoint and shared secret.
export function createGoogleSheetStore({ url, token, fetchImpl = fetch }) {
  async function call(payload) {
    if (!url || !token) throw new Error('Missing Google Sheet connection');
    const endpoint = new URL(url);
    if (endpoint.origin !== 'https://script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(endpoint.pathname)) throw new Error('Invalid Apps Script endpoint');
    const response = await fetchImpl(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, token }), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('Google Sheet connection failed');
    const result = await response.json();
    if (!result.ok) throw new Error('Google Sheet operation failed');
    return result;
  }
  return {
    async getWithMetadata() {
      const result = await call({ action: 'read' });
      if (!result.data || !Array.isArray(result.data.plans) || typeof result.data.revision !== 'string') throw new Error('Invalid sheet configuration');
      return { data: result.data, etag: result.data.revision };
    },
    async setJSON(key, data, options) {
      const result = await call({ action: 'save', revision: options.onlyIfMatch, plans: data.plans });
      return { modified: result.modified, data: result.data };
    },
  };
}
