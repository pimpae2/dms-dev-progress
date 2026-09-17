# Project Progress

The root page is a read-only Project Progress dashboard. It discovers every
visible tab in the configured Google workbook and renders one project at a time.
Adding, renaming, reordering, or deleting a workbook tab is reflected on the
next page load or automatic refresh; there is no settings page or write API.

- Project Progress: `/`
- DEV and document dashboard: `/home`
- Workbook: `1Hi1M7GNhA5G2p7BgiGLH3F5A3aKgO2A-iU46XGOvFC8`

Each project tab must contain a `สถานะ` column and either a
`หน้าจอ/เมนู/หัวข้อ` or `คำอธิบาย` column. The immediately preceding column is
the item number. Numbered rows without a status create system groups; flat tabs
without group rows are shown as one group. `Developed` and `Tested` count as
complete. Rows without a status are not counted.

The workbook must be readable by anyone with the link. The Netlify Functions
proxy is restricted to this workbook and exposes read-only GET endpoints:

- `/api/workbook` lists visible tabs.
- `/api/sheet?gid=<tab-id>` returns one tab as CSV.

Run locally with Node.js 20 or newer:

```sh
node server.mjs
```

Build the Netlify output with:

```sh
npm run build
```

`netlify.toml` publishes `dist` and deploys the read-only Functions. No
environment variables, Apps Script deployment, administrator token, or storage
service is required.
