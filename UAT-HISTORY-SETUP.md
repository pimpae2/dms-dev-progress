# UAT history setup

The source workbook only needs viewer access for the Google account running the script. History is stored in a new workbook owned by that account. The source is never modified.

1. Open https://script.google.com and create a standalone project.
2. Paste `apps-script/uat-history.gs` into the script editor.
3. Run `setupUatHistory` and authorize it with the account that can read the source.
4. The execution log contains the new `UAT Progress History` workbook link. The first snapshot is recorded immediately; an hourly trigger is installed automatically. Re-running setup reuses the workbook and trigger.
5. To let this public dashboard read history, publish only the `UAT-History` tab as CSV via File > Share > Publish to web. This makes the exported task names, machine names, codes, statuses and capture times publicly readable. Do not publish it if your organization does not allow this; use an authenticated backend instead.
6. Put the published CSV URL into `UAT_HISTORY_CSV_URL` in `project-progress.js`, then build and deploy the site normally.

The comparison uses the last available capture from the previous calendar day in Asia/Bangkok. Capture time is shown explicitly; hourly triggers are approximate, not guaranteed midnight captures. Missing yesterday data stays unavailable rather than showing zero progress. The first day therefore has no yesterday comparison.

Review Apps Script Executions and trigger failure emails if history stops updating. A new row per task is appended each hour; archive old history periodically to stay within Google Sheets limits. Keep yesterday's complete snapshot available. Task codes must remain unique and stable; added and removed codes are reported separately.

No web app deployment or API token is required for this public CSV option. Do not expose OAuth credentials in frontend code.
