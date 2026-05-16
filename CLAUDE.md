# CLAUDE.md — COC Website

Live URL: `toddsroadcoctt` (GreenGeeks) · Repo: `brandonr2630/coc-website`

## Architecture

Static HTML/CSS/JS church site. No build system or bundler — files deployed as-is.

- **`index.html`** — main site page
- **`BIBLE TRANSLATIONS/`** — JSON translation files (kjv, asv, web, lsv, ylt, lxxe, kjvs, asvs, rvr09, hebrew, greek-nt)
- **`COMMENTARIES/`** — JSON commentary files (adam-clarke, matthew-henry, jamieson-fausset-brown)
- **`DICTIONARY/`** — JSON reference files (eastons, smiths)
- **`SCRIPTS/`** — local Node scripts for downloading/patching data; not deployed
- **`ARCHIVES/`** — old versions; never edit, never deploy
- **`LIBRARY/`** — local ebook conversion tools; not deployed

Contact form backend is not yet wired up.

## Deployment

Push to `master` auto-deploys via GitHub Actions → cPanel Fileman API (GreenGeeks). Deploy dir: `/home/terranre/public_html/toddsroadcoctt`. Manual redeploy: Actions → Deploy to cPanel → Run workflow.

## Session context

See `handoff.md` for the running log of completed work and known issues.
