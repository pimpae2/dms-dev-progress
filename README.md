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
The settings page has no sign-in; add access control before a shared deployment.

Each source needs a Google Sheets URL with the target tab's `gid`. The sheet
must be readable through Google's CSV endpoint. Required headers are
`คำอธิบาย` and `สถานะ`; the column immediately before `คำอธิบาย` contains
hierarchical item numbers. A numbered heading without a status defines a group,
and rows with a title, item number and status are counted. `Developed` and
`Tested` count as complete; other nonblank statuses remain outstanding.

The original ORG source is provided by default. `/project_plan_org` redirects
to `/project_plan`. Individual plans can be linked as `/project_plan?plan=org`.
Set the `PORT` environment variable to use another local port.

## Netlify (static viewing)

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
