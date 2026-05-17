# COC Website

Church website and Bible study app for the Church of Christ at Todd's Road, Trinidad.

**Live:** `toddsroadcoctt` (GreenGeeks cPanel)  
**Repository:** https://github.com/brandonr2630/coc-website

---

## Overview

Two independent HTML files, both deployed as static assets:

1. **`index.html`** — Church landing page with hero, CTAs, and information
2. **`bible-reader.html`** — Full-featured Bible study app (~5000 lines of inline HTML/CSS/JS)

**No backend servers, no database, no authentication.** Purely client-side with optional external API integration for copyright-protected content.

---

## Architecture

### Tech Stack

- **Vanilla HTML / CSS / JavaScript** — no build system, no bundler, no npm
- **Service Worker** — PWA offline support for `bible-reader.html`
- **Translation & Reference Data** — JSON files served from repo root
- **External APIs** (read-only, no authentication):
  - `bolls.life` — NKJV translation (copyrighted, API-only)
  - `bible.helloao.org` — Commentary data (Adam Clarke, Matthew Henry, Jamieson-Fausset-Brown)

### Data Sources

**Public Domain (local JSON files, deployed to repo root):**
- KJV, ASV, WEB, YLT, LSV, LXXE, Darby, RVR09
- KJV + Strong's, ASV + Strong's
- Hebrew OT, Greek NT
- Cross-references (all 66 books)
- Easton's Bible Dictionary, Smith's Bible Dictionary

**Copyrighted (external APIs only, never cached locally):**
- NKJV — fetched from `bolls.life/get-chapter` on demand
- Commentaries — fetched from `bible.helloao.org/api` and cached in localStorage

---

## File Structure

```
coc-website/
├── index.html                  Church landing page
├── bible-reader.html           Bible study app (main file, ~5000 lines)
├── service-worker.js           PWA cache v12 — bump on every bible-reader.html change
├── manifest.json               PWA manifest (mobile add-to-home-screen)
├── README.md                   This file
├── HANDOVER.md                 Full technical docs — architecture, pending work, workflows
├── .gitignore                  Ignores source/working directories
│
├── Translation & Reference Data (deployed):
│   ├── kjv.json, asv.json, web.json, ylt.json, lsv.json, lxxe.json
│   ├── rvr09.json, darby.json
│   ├── kjvs.json, asvs.json               (with Strong's numbers)
│   ├── hebrew.json, greek-nt.json         (Original languages)
│   ├── adam-clarke.json, matthew-henry.json, jamieson-fausset-brown.json
│   ├── eastons.json, smiths.json
│   └── crossrefs.json                     (Cross-references)
│
├── Favicons & OG Tags:
│   ├── favicon.ico, favicon-32x32.png, favicon-16x16.png, apple-touch-icon.png
│   └── og_banner.jpg                      (Open Graph preview image)
│
└── Source/Working Directories (gitignored):
    ├── BIBLE TRANSLATIONS/               Source XMLs for all translations
    ├── COMMENTARIES/                     Commentary source data & scripts
    ├── DICTIONARY/                       Dictionary source data
    ├── SCRIPTS/                          Node.js converters (zefania-to-json.js, etc.)
    ├── BRAND/                            Logo assets
    ├── LIBRARY/                          E-book conversion scripts
    └── ARCHIVES/                         Versioned snapshots of bible-reader.html
```

---

## Bible Reader Features

### Multiple Translations
- **12 public-domain translations** stored as local JSON, fetched client-side
- **NKJV** via `bolls.life` API (copyright)
- **Translation picker** in controls; keyboard shortcut support

### Study Tools
- **Strong's Concordance** — tap any word in KJV+Strong's or ASV+Strong's versions
- **Cross-references** — click reference link to jump; full panel with all xrefs for a verse
- **Commentaries** — 3 commentaries (Adam Clarke, Matthew Henry, JFB) via API, cached locally
- **Bible Dictionaries** — Easton's and Smith's for terms and places
- **Search** — full-text search (bolls.life API for NKJV, local JSON scan for others)

### Personal Study
- **Sermon Notes** — create rich-text notes per study session (localStorage)
- **Verse Selection** — right-click any verse → "Add to Notes"
- **Note Exports** — TXT, DOCX (via CDN), PDF (via browser print)

### Reading Modes
- **Normal Mode** — full UI with controls and panels
- **Reading Mode** — hides all controls; distraction-free reading
- **Presentation Mode** — fullscreen speaker view

### Accessibility
- **Dark Mode** — toggle via settings; persists to localStorage
- **Font Size Controls** — A−/A+ buttons; persists to localStorage
- **Multiple Font Families** — serif, sans-serif, dyslexia-friendly OpenDyslexic
- **Responsive Design** — desktop, tablet, mobile (≤540px) optimized

### Offline Support
- **Service Worker** caches app shell and all local JSON files
- **Cache version:** `coc-bible-v12` — bump this on every `bible-reader.html` deploy
- Returns users get fresh code on next load (hard refresh may be needed on mobile)

---

## Deployment

### Auto-Deploy on Push

Every push to `master` triggers GitHub Actions:
1. Checkout code
2. Upload via cPanel Fileman API to `/home/terranre/public_html/toddsroadcoctt/`
3. Only changed files are uploaded (incremental)

### Manual Redeploy

Go to **Actions** → **Deploy to cPanel** → **Run workflow** → select `master` branch

### Before Pushing `bible-reader.html` Changes

**Always bump the service worker cache version:**
- Open `service-worker.js`
- Find line 7: `const CACHE = 'coc-bible-vN';`
- Increment N by 1 (e.g., `coc-bible-v12` → `coc-bible-v13`)
- Commit this change along with your edits
- Push to `master`

Failing to bump the version means returning visitors will receive stale cached HTML.

### Required GitHub Secrets

| Secret | Value |
|--------|-------|
| `CPANEL_API_TOKEN` | API token (ask team admin) |
| `CPANEL_HOST` | `https://chi203.greengeeks.net:2083` |
| `CPANEL_USER` | `terranre` |

---

## Adding Translations

To add a new public-domain translation from [`seven1m/open-bibles`](https://github.com/seven1m/open-bibles):

### 1. Download & Convert

```powershell
# Download the XML source
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/seven1m/open-bibles/master/<filename>.xml" `
  -OutFile "BIBLE TRANSLATIONS/<filename>.xml"

# Convert to JSON using Node.js
node SCRIPTS/zefania-to-json.js "BIBLE TRANSLATIONS/<filename>.xml" "<key>.json"

# Copy to repo root (reader fetches from root on deploy)
Copy-Item "BIBLE TRANSLATIONS/<key>.json" "<key>.json"
```

### 2. Update `bible-reader.html`

In the `<script>` block, add to each location:

1. **`TRANSLATIONS` object** (line ~2360):
   ```javascript
   const TRANSLATIONS = {
     // ... existing translations ...
     'bbe': 'Bible in Basic English',
   };
   ```

2. **`TRANSLATION_ABBR` object** (line ~2385):
   ```javascript
   const TRANSLATION_ABBR = {
     // ... existing abbreviations ...
     'bbe': 'BBE',
   };
   ```

3. **`LOCAL_TRANSLATIONS` Set** (line ~2390):
   ```javascript
   const LOCAL_TRANSLATIONS = new Set([
     // ... existing keys ...
     'bbe',
   ]);
   ```

4. **Translation dropdown in HTML** (search for `<select id="translation-select">` and add):
   ```html
   <option value="bbe">Bible in Basic English (BBE)</option>
   ```

5. **Bump service worker version** (line 7 of `service-worker.js`)

### 3. Commit & Push

```bash
git add bible-reader.html <key>.json service-worker.js
git commit -m "feat(translations): add <key> — <Full Name>"
git push origin master
```

---

## Performance & Caching

- **First load:** Downloads HTML, CSS, JS, all local JSON translations (~800KB total)
- **Service worker:** Caches everything in `coc-bible-vN`
- **Subsequent loads:** Served from cache; external APIs (bolls.life, bible.helloao.org) only called on-demand
- **Commentary caching:** Downloaded once, cached in localStorage; persists across sessions

---

## Known Limitations & TODOs

See **HANDOVER.md** for the full pending work list, including:
- Multiple named bookmarks
- Shareable links (URL hash deep-linking already works; needs copy button)
- Verse-level personal notes
- Reading plans (365-day, curated tracks)
- Print stylesheet improvements
- Homepage CRO (button labels, phone number, congregation photo)
- Contact form backend (Formspree or EmailJS recommended)

---

## Tech Notes for Developers

- **No transpilation:** All JS is vanilla ES6+; works in all modern browsers
- **Inline everything:** CSS and JS are embedded in HTML files (no separate assets needed)
- **localStorage:** Used for user preferences (dark mode, font size, notes, bookmarks)
- **Fetch API:** All JSON loads use `fetch()`; external APIs return JSON
- **Responsive:** Mobile-first design; breakpoint at 540px for pill layout

---

## Support & Questions

For architecture questions, see **HANDOVER.md**. For deployment issues, check GitHub Actions logs or GreenGeeks cPanel Fileman.
