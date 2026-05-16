# COC Website

Church website and Bible study app for the Church of Christ at Todd's Road, Trinidad.

**Live:** toddsroadcoctt (GreenGeeks)

## Structure

| File | Purpose |
|------|---------|
| `index.html` | Church landing page |
| `bible-reader.html` | Full Bible study app (~5000 lines) |
| `service-worker.js` | PWA offline cache — bump version on every `bible-reader.html` deploy |
| `manifest.json` | PWA manifest |
| `kjv.json`, `asv.json`, … | Translation JSONs fetched client-side |
| `adam-clarke.json`, `matthew-henry.json`, `jamieson-fausset-brown.json` | Commentary data |
| `eastons.json`, `smiths.json` | Bible dictionary data |
| `HANDOVER.md` | Full technical handover — architecture, session history, pending work |

## Deploy

No automated workflow yet. Push to `master` does not auto-deploy — use cPanel Git Version Control or upload manually.

**Before pushing any change to `bible-reader.html`:** bump the service worker cache version in `service-worker.js` line 7 (`coc-bible-vN` → `coc-bible-v(N+1)`).

## Repository

https://github.com/brandonr2630/coc-website
