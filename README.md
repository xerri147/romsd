# udrop.com file listing

Same idea as the UploadG site: a scheduled job reads your udrop.com account
and writes `files.json`; the page (the tree-view / beige style) displays it.
Read-only, no upload UI, keys never reach the browser.

```
index.html                  the page
files.json                  generated listing (committed by the job)
scripts/sync.js             reads the udrop.com API
.github/workflows/sync.yml  runs every 5 minutes
```

## Setup

1. Push these files to a **new** repo (separate from the UploadG one). Settings
   → Pages → deploy from branch `main`, root.
2. Get your two API keys. udrop's docs (udrop.com/api) don't show exactly
   where to generate them — look under your account settings for something
   like "API" or "Developer". If you can't find it, tell me what your account
   settings screen shows and I'll point you to the right spot.
3. Settings → Secrets and variables → Actions → New repository secret, twice:
   - `UDROP_KEY1` — your first key
   - `UDROP_KEY2` — your second key
4. Actions tab → **Sync file list** → Run workflow. That fills in `files.json`.

## How this one differs from the UploadG version

- udrop hands back a ready-to-use public link (`url_file`) directly from the
  folder listing, so there's no separate "create a share link" step — one API
  call per folder instead of one-plus-one per file. Simpler and faster.
- udrop's listing doesn't return a modified date for individual files (only
  for folders), so the Date Modified column will be blank on files. If that
  bothers you, say so and I can add a per-file `/file/info` call — it just
  means one extra API call per file, which adds up for big drives.
- Session tokens (`access_token`) expire after an hour of inactivity, but
  since each workflow run is a fresh process, `sync.js` just re-authenticates
  with your two keys at the start of every run — you don't need to do
  anything about this.

## Options

Set these under `env:` in `.github/workflows/sync.yml`:

- `ROOT_FOLDER_ID` — publish only one folder instead of your whole account.

## Notes

- Five minutes is GitHub's minimum cron interval, and scheduled runs are
  best-effort — during busy periods they can be several minutes late or
  skipped. Push a commit or use Run workflow if you need it immediately.
- GitHub disables scheduled workflows in repos with 60 days of no activity.
- Anything published here is downloadable by anyone with the link (and
  udrop's `isPublic` folder setting affects this too) — keep private files
  out of the synced folder.
