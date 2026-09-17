import { getStore } from '@netlify/blobs';
import seed from '../../plans-public.json' with { type: 'json' };
import { createPlansHandler } from '../plans-handler.mjs';

export default request => createPlansHandler({
  store: getStore({ name: 'project-plan-settings', consistency: 'strong' }),
  secret: process.env.PLAN_ADMIN_TOKEN,
  seed,
})(request);

export const config = { path: '/api/plans' };
