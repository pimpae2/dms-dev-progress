import { createGoogleSheetStore } from '../google-sheet-store.mjs';
import { createPlansHandler } from '../plans-handler.mjs';

const scriptUrl = 'https://script.google.com/macros/s/AKfycbzLd3gxHGmOmj5YYh3Gt7WK7eIs6JyEyVr1kY27HPxhFZSI6mwPdeJPgxMFxgYyKwzbPQ/exec';

export default request => {
  if (!process.env.GOOGLE_PLAN_SCRIPT_TOKEN) return Response.json({
    error: 'กรุณาตั้งค่า GOOGLE_PLAN_SCRIPT_TOKEN บน Netlify แล้ว Deploy ใหม่',
  }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return createPlansHandler({
  store: createGoogleSheetStore({ url: process.env.GOOGLE_PLAN_SCRIPT_URL || scriptUrl, token: process.env.GOOGLE_PLAN_SCRIPT_TOKEN }),
  secret: process.env.PLAN_ADMIN_TOKEN,
  seed: { revision: 0, plans: [] },
  })(request);
};

export const config = { path: '/api/plans' };
