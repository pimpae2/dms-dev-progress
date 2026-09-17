# Project Progress

Run with Node.js 20 or newer:

```sh
node server.mjs
```

- Dashboard: http://127.0.0.1:4175/
- Project plans: http://127.0.0.1:4175/project_plan
- Sheet settings: http://127.0.0.1:4175/set_plan_sheet

Settings are persisted in `plan-settings.json` beside the server. All browsers
using this server share the same settings. The preview listens on loopback only;
it is not a public deployment. Static-only hosting cannot save these settings.
The local server has no sign-in and should remain on loopback. The Netlify API
requires an administrator token for edits.

Each source needs a Google Sheets URL with the target tab's `gid`. The sheet
must be readable through Google's CSV endpoint. Required headers are
`คำอธิบาย` and `สถานะ`; the column immediately before `คำอธิบาย` contains
hierarchical item numbers. A numbered heading without a status defines a group,
and rows with a title, item number and status are counted. `Developed` and
`Tested` count as complete; other nonblank statuses remain outstanding.

The original ORG source is provided by default. `/project_plan_org` redirects
to `/project_plan`. Individual plans can be linked as `/project_plan?plan=org`.
Set the `PORT` environment variable to use another local port.

## Netlify (shared online settings)

1. Deploy this repository through Netlify's Git integration (Node 22). The build
   command and Functions directory are configured in `netlify.toml`.
2. In Netlify Project configuration > Environment variables, add
   `PLAN_ADMIN_TOKEN` with a long, randomly generated password (at least 32
   characters). Make it available to Functions, then redeploy. Never commit it.
3. Open `/set_plan_sheet`, enter that password, check the sheet, then save.
   The password is kept in page memory only; refresh or logout clears it.

For CLI deployment of an existing site, run `npm ci`, `npx netlify login`,
`npx netlify link`, then `npx netlify deploy --build --prod` from the repository
root after setting the environment variable. Check the selected site before
deploying. Uploading only `dist` through drag-and-drop does not install Functions.

The `/api/plans` Function stores source configuration in a site-wide Netlify
Blobs store. The first read uses `plans-public.json`; after the first save,
saved data persists across deploys and is not overwritten by the seed file.
Public requests expose enabled sources only. Administrative reads include hidden
sources. Writes validate the source list and reject stale revisions. Google Sheet
contents remain in Google; only source names, URLs, order and visibility are stored.
Preview deployments on the same site share this store, so do not edit production
configuration from deploy previews. Keep the admin password private.

Run `npm test` for API tests with an in-memory store. Actual Netlify storage needs
a deployed Function; the local `node server.mjs` continues using its local file.

## Static-only fallback

Run `node build.mjs`, then upload the **dist folder** to Netlify. For a Git-based
deploy, `netlify.toml` sets the build command and publish directory automatically.
The build exports enabled sources from local `plan-settings.json` when present,
otherwise from the tracked `plans-public.json`. For Git deployments, update
`plans-public.json` with the sources you intend to publish; local settings are
gitignored and are not uploaded automatically.

When `/api/plans` is unavailable on static hosting, the site reads
`plans-public.json` and then fetches the live sheet contents from Google.
The published settings page is read-only. Change settings locally and rebuild
to publish a new source list. Live online editing requires a hosted API and
persistent shared storage; uploading `server.mjs` alone does not provide this.
The export deliberately excludes the local server and private settings file.
