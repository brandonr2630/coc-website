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

Every push to `master` auto-deploys via GitHub Actions → cPanel Fileman API (GreenGeeks).

- **Incremental push:** only files changed in the push are uploaded
- **Full redeploy:** trigger manually via Actions → Deploy to cPanel → Run workflow

**Before pushing any change to `bible-reader.html`:** bump the service worker cache version in `service-worker.js` line 7 (`coc-bible-vN` → `coc-bible-v(N+1)`).

### Required GitHub Secrets

| Secret | Value |
|--------|-------|
| `CPANEL_API_TOKEN` | cPanel API token |
| `CPANEL_HOST` | `https://chi203.greengeeks.net:2083` |
| `CPANEL_USER` | `terranre` |

## Repository

https://github.com/brandonr2630/coc-website
