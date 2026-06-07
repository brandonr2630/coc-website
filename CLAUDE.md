# CLAUDE.md — COC Website

Live URL: `https://toddsroadcoctt.org` · Repo: `brandonr2630/coc-website`

## Architecture

Static HTML/CSS/JS church site. No build system or bundler — files deployed as-is.

- **`index.html`** — main site page
- **`bible-reader.html`** (~8500 lines) — entire Bible reader app (inline CSS + JS)
- **`service-worker.js`** — PWA offline, cache-first for app shell + JSON data, network-only for `bolls.life` and Google Fonts. Current `CACHE` name: `coc-bible-v47`. **Always read the current version from `origin/master`, never the local file** (another PR may have already bumped it):
  ```bash
  git fetch origin master
  current=$(git show origin/master:service-worker.js | grep -oP "coc-bible-v\K\d+")
  sed -i "s/coc-bible-v[0-9]*/coc-bible-v$((current + 1))/" service-worker.js
  ```
- **`BIBLE TRANSLATIONS/`** — JSON translation files (kjv, asv, web, lsv, ylt, lxxe, kjvs, asvs, rvr09, hebrew, greek-nt)
- **`COMMENTARIES/`** — JSON commentary files (adam-clarke, matthew-henry, jamieson-fausset-brown)
- **`DICTIONARY/`** — JSON reference files (eastons, smiths)
- **`SCRIPTS/`** — local Node scripts for downloading/patching data; not deployed
- **`ARCHIVES/`** — old versions; never edit, never deploy
- **`LIBRARY/`** — local ebook conversion tools; not deployed

## Backends

- **Supabase** — highlights persistence + user auth (anonymous, email/password, Google OAuth PKCE). Project: `COC Website` · ID `bxdenfhpmbsxvaqoxyei` · region `us-east-1`.
- **bolls.life API** — NKJV text (copyrighted; never cached)
- **bible.helloao.org** — additional commentaries (John Gill, Keil-Delitzsch, Tyndale); cached in localStorage

## Deployment

Push to `master` auto-deploys via GitHub Actions → cPanel Fileman API (GreenGeeks). Deploy dir: `/home/terranre/public_html/toddsroadcoctt`. Manual redeploy: Actions → Deploy to cPanel → Run workflow.

## Session context

See `handoff.md` for the running log of completed work and known issues.
