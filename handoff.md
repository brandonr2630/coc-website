# COC Website — Handover File

*Last updated 2026-05-17 (session 7)*

---

## Project Overview

Single-page church website for the Church of Christ at Todd's Road, Trinidad.

**Two deployable files:**
- `index.html` — landing page (hero, CTAs, information)
- `bible-reader.html` — Bible study app with multiple translations, Strong's numbers, cross-references, commentaries, and notes

**Live URL:** `toddsroadcoctt` (GreenGeeks cPanel)  
**GitHub repo:** `brandonr2630/coc-website`  
**Deploy:** Every push to `master` (via PR) auto-deploys via GitHub Actions → cPanel Fileman API.

---

## Tech Stack

- **Vanilla HTML / CSS / JS** — no build system, no framework, no npm, no bundler
- **Service worker (`service-worker.js`)** — PWA offline support for `bible-reader.html`, cache version `coc-bible-v12`
- **Translation & reference data** — all served as JSON files from repo root (fetched client-side)
- **External APIs** (read-only, no auth):
  - `bolls.life` — NKJV translation (copyrighted, API-only, never cached locally)
  - `bible.helloao.org` — commentaries (Adam Clarke, Matthew Henry, Jamieson-Fausset-Brown)

**No backend servers, no database, no authentication.**

---

## Bible Reader Architecture (`bible-reader.html`)

### Translations

| Key | Label | Source | Cache | Notes |
|-----|-------|--------|-------|-------|
| `kjv` | King James Version | `kjv.json` | Local | Public domain |
| `asv` | American Standard Version | `asv.json` | Local | Public domain |
| `web` | World English Bible | `web.json` | Local | Public domain |
| `ylt` | Young's Literal Translation | `ylt.json` | Local | Public domain |
| `lsv` | Literal Standard Version | `lsv.json` | Local | Public domain |
| `lxxe` | English Septuagint (1851) | `lxxe.json` | Local | Public domain |
| `rvr09` | Reina-Valera 1909 | `rvr09.json` | Local | Public domain |
| `darby` | Darby Bible (1890) | `darby.json` | Local | Public domain |
| `kjvs` | KJV + Strong's | `kjvs.json` | Local | Public domain |
| `asvs` | ASV + Strong's | `asvs.json` | Local | Public domain |
| `hebrew` | Hebrew OT | `hebrew.json` | Local | Leningrad Codex — free with citation |
| `greek-nt` | Greek NT | `greek-nt.json` | Local | Public domain |
| `nkjv` | New King James Version | bolls.life API | Never | Copyrighted — API only, never cached locally |

**Sets:**
- `LOCAL_TRANSLATIONS` = all except `nkjv` (fetched from repo root)
- `STRONGS_TRANSLATIONS` = `{kjvs, asvs}` (Strong's numbers embedded in verse text)

### Reference Data

All stored as JSON files in repo root, fetched on demand:
- **Commentaries** (from `bible.helloao.org` API, then cached in localStorage):
  - Adam Clarke Commentary
  - Matthew Henry Commentary
  - Jamieson-Fausset-Brown Commentary
- **Dictionaries** (local):
  - Easton's Bible Dictionary (`eastons.json`)
  - Smith's Bible Dictionary (`smiths.json`)
- **Cross-references** (`crossrefs.json`) — all 66 books with verse-level cross-ref links

### Key JS Globals

- `currentBook`, `currentChapter`, `currentTranslation` — current view state
- `BIBLE_CACHE` — lazily populated per-translation on first load/search
- `BOOKS` — array of `{name, chapters, testament}` for all 66 books
- `TRANSLATION_ABBR` — short labels for pill buttons (e.g. `kjv → 'KJV'`)
- `BOOK_ABBR` — 66-book short names for mobile ≤540px (e.g. `Genesis → 'Gen'`)

### UI Layout

**Three zones:**
1. **Fixed top nav** — logo left, hamburger right (overlay nav on all screens)
2. **Page wrap** — Bible text centered, max 860px. Large serif font, generous line height, generous padding
3. **Fixed controls** — now consolidated into the page wrap as regular inline rows

### Controls & Interaction

The reader uses three horizontal control rows at the top of the page (not a floating pill):

**Row 1: Old Testament | New Testament | Translation**
- `testament-row` — flex container with OT/NT buttons and translation picker
- OT/NT toggle active/inactive state via `.active` class

**Row 2: Book | Chapter | Verse | Search**
- `nav-dropdowns` — flex container with three `<select>` elements + search icon
- Book select `flex: 2.2`; Chapter `flex: 1.6`; Verse `flex: 1.2` (responsive widths)
- Search icon (🔍) opens the search panel on mobile/tablet as bottom sheet

**Row 3: Text Size | Reading Mode + Present Mode**
- `reader-toolbar` — left side has A−/A+ font controls; right side has "Reading Mode" and "Present" toggle buttons
- Reading Mode hides all controls and navigation; Presentation Mode is fullscreen speaker view

### Panels (all `position: fixed`)

| Panel | Trigger | Desktop position | Mobile position |
|-------|---------|-----------------|----------------|
| Search | 🔍 button | Left side, 360px wide | Bottom sheet (draggable, 3 snaps) |
| Strong's | tap word in KJV+S/ASV+S | Right side, 360px wide | Bottom sheet |
| Notes | 📝 in toolbar or context menu | Right side, 380px wide | Bottom sheet |
| X-ref | click verse cross-ref link | Left side, 320px wide | Bottom sheet |
| Commentary | select commentary in dropdown | Right side, 400px wide | Bottom sheet |

### Search Panel (word search)

- **Two paths:**
  - `bolls.life` API for NKJV
  - Local JSON scan for all other translations
- **Filters:** Testament / Section / Book / Strong's # (Strong's # only for `kjvs`/`asvs`)
- **Pagination:** 25 results per page; status bar shows "1–25 of 347 results in KJV"
- **Mobile interaction:** Bottom sheet with 3 snap heights — 180px (compact), 55vh (default), 85vh (expanded)
- **CSS variable:** `--search-pb` on `:root` drives `.page-wrap` padding-bottom dynamically

### Notes / Sermon Notes Feature

- **Data model:** `coc_notes_sessions` in localStorage (one key = one note session)
- **Interaction:** Right-click any verse → "Add to Notes"; or use selection toolbar → Notes button
- **Rich-text toolbar:** Bullet list / numbered list / indent
- **Export:** TXT, DOCX (via `docx.js` from CDN), PDF (via `window.print`)

### Service Worker

Cache version is `coc-bible-v12`. **Bump this on every deploy that changes `bible-reader.html`** — otherwise returning visitors on mobile get stale cached files.

Location: `service-worker.js`, line 7: `const CACHE = 'coc-bible-v12';`

### Dark Mode

- Toggle via settings gear in toolbar → "Dark Mode"
- Persists to localStorage as `bibleTheme`
- All colors respond to `[data-theme="dark"]` CSS selector
- Page wrap applies theme on page load via inline script (line 6)

---

## Session Work — 2026-05-17 (session 7)

### Global Formatting Toolbar Implementation

**Feature 1a + 1b completion:**
Completed consolidation of notes formatting controls into a single global toolbar at the top of the notes panel.

**Changes Made:**
- **Removed per-entry formatting toolbars** — Each entry no longer has its own formatting controls
- **Implemented global focus tracking** — New `notesActiveFocusedElement` variable tracks which contenteditable area is active (intro or entry)
- **Created 4 global formatting functions:**
  - `notesGlobalFmt(cmd)` — applies bold, italic, underline, insertUnorderedList, insertOrderedList
  - `notesGlobalFmtFont(fontName)` — applies font family to active element
  - `notesGlobalFmtSize(size)` — applies font size to active element  
  - `notesGlobalIndent(dir)` — applies indent (+1) or outdent (-1) to active element
  - `notesActiveElementSyncToolbar()` — syncs list button active states
- **Updated event handlers** — Both intro and entry contenteditable areas track focus via `onfocus="notesActiveFocusedElement=this"`
- **Added complete CSS styling** — Toolbar with light/dark mode support, hover states, active states (green for list buttons when in list mode)
- **Removed obsolete functions** — Deleted `notesEntryFmt()`, `notesEntryIndent()`, `syncEntryToolbar()`, old intro-level formatting functions

**UI/UX Improvements:**
- Single point of control for all formatting — no confusion about which toolbar to use
- Cleaner entry layout without per-entry toolbars
- Consistent button styling and behavior across all editors
- List buttons (≡ and 1.) highlight green when formatting is active in current selection
- Font and size dropdowns reset after selection (no lingering state)

**Files Modified:**
| File | Changes |
|------|---------|
| `bible-reader.html` | 177 insertions, 94 deletions — global toolbar, functions, CSS, entry rendering |

**Deployment:**
- Commit: `87057ac` — "feat(notes): consolidate formatting toolbar to global, single-point control"
- PR #15 created and merged to `master`
- GitHub Actions deployment completed successfully (12s)
- Live at `toddsroadcoctt` ✅

---

## Session Work — 2026-05-17 (session 6)

### Bug Investigation & Code Audit

**NKJV Search Bug**
- Investigated word search failure on NKJV
- Root cause: bolls.life API returning HTTP 429 (Too Many Requests) rate-limit errors
- Added client-side rate limiting with exponential backoff retry logic (3 retries, 1s/2s/4s waits)
- Attempted fix unsuccessful — bolls.life API continues rate-limiting
- Determined no free, reliable alternative exists without copyright issues
- **Decision:** Leave as-is; users can read NKJV but search is disabled; 12 other translations have working search

**Comprehensive Code Audit**
- Reviewed entire 5,793-line `bible-reader.html` file
- Identified 10 improvement categories: performance, memory leaks, accessibility, error handling, mobile UX
- Created prioritized issue list with effort estimates and impact assessment
- See "Known Issues & Technical Debt" section above for full details

### Files Modified
| File | Change |
|------|--------|
| `bible-reader.html` | Added rate-limiting queue for bolls.life API calls with exponential backoff retry logic |
| `handoff.md` | Added "Known Issues & Technical Debt" section with prioritized improvement list |
| `handoff.md` | Updated architecture note about NKJV search limitation |

---

## Session Work — 2026-05-16 (session 4)

### GitHub Infrastructure

Switched to the centralised reusable deploy workflow.

| Change | Commit |
|--------|--------|
| Reusable deploy workflow — 130-line script → 14-line call to `brandonr2630/projects` | `7fec0d2` |
| Auto-merge enabled on repo | — |
| GitHub Projects board linked | [projects/1](https://github.com/users/brandonr2630/projects/1) |

---

## Session Work — 2026-05-16 (session 3)

### Infrastructure Overhaul

| Change | Commit |
|--------|--------|
| Deploy workflow: hybrid binary/text upload, directory creation, `workflow_dispatch` | `acb2af4` |
| Removed dead `.cpanel.yml` | `952ea8e` |
| `HOST` and `CPANEL_USER` moved to GitHub Secrets | `a47061d` |
| README corrected (deploy section, live URL) | `b20b783` |
| Branch protection ruleset on `master` — requires PR | — |
| Folder renamed `COC Website/` → `coc-website/` | — |

**Required GitHub Secrets:** `CPANEL_API_TOKEN`, `CPANEL_HOST` (`https://chi203.greengeeks.net:2083`), `CPANEL_USER` (`terranre`)

---

## Previous Session Work

### Session 2 (2026-05-13) & Earlier

See git log for detailed commit history. Key milestones:
- Floating pill nav → consolidated controls at page top
- Multiple translation support with local JSON + NKJV API fallback
- Commentary integration via `bible.helloao.org` API
- Search, cross-references, notes, Strong's concordance, dark mode
- PWA with service worker caching
- Responsive mobile/tablet layout

---

## Known Issues & Technical Debt

### NKJV Word Search Not Working
- **Issue:** bolls.life API returns HTTP 429 (Too Many Requests) — rate limiting prevents searches
- **Root cause:** API is heavily rate-limited; no reliable free alternative without copyright issues
- **Status:** NKJV chapters still load and display, but word search fails
- **Workaround:** Use one of 12 other public-domain searchable translations (KJV, ASV, WEB, YLT, etc.)
- **Long-term:** Consider licensing NKJV from Thomas Nelson or switching to public-domain translations

### Code Quality & Performance Issues (Prioritized by Impact)

| Priority | Issue | Impact | Effort | Status |
|----------|-------|--------|--------|--------|
| 🔴 CRITICAL | `STRONGS_DATA` embedded in HTML bloats file to 6.9MB | 80% slower initial load on mobile | 3-4 hrs | Not started |
| 🔴 HIGH | Missing error handling on `fetch()` calls | App hangs on network failure; no user feedback | 2 hrs | Not started |
| 🟠 MEDIUM | 210+ repeated `getElementById()` calls; no DOM caching | 20-30% slower interaction response time | 1-2 hrs | Not started |
| 🟠 MEDIUM | Event listeners never cleaned up on navigation | Memory leak; slowdown after 20+ navigations on mobile | 2 hrs | Not started |
| 🟠 MEDIUM | Interlinear mode loads entire 30MB JSON file into memory | Can crash low-end mobile devices | 3 hrs | Not started |
| 🟠 MEDIUM | No request cancellation on rapid navigation | Stale data can overwrite current view; wasted bandwidth | 1-2 hrs | Not started |
| 🟡 LOW-MEDIUM | Browser compatibility gaps (backdrop-filter, CSS variables) | Limited support in older/enterprise browsers | 2 hrs | Not started |
| 🟡 MEDIUM | Accessibility: missing ARIA labels, keyboard navigation | Screen reader users can't navigate; poor keyboard UX | 4 hrs | Not started |
| 🟡 LOW | `console.log()` statements left in production | Minor (debug noise, data exposure) | 0.5 hrs | Not started |

### Quick Wins (Low effort, immediate improvement)
1. **Remove console.log statements** (lines 2963, 4815, 4820, 4829) — 30 min
2. **Add user-friendly error messages** for failed chapter/search loads — 1 hr
3. **Cache DOM element references** (`const DOM = { versesArea: el, ... }`) — 1-2 hrs

---

## Completed Notes Features (Phase 1)

✅ **1a: In-Session Search** — Real-time filtering of notes within current session with text highlighting  
✅ **1b: Session Sidebar** — Browse, load, and delete all saved note sessions with metadata (verse count, book count, date)  
✅ **1c: Global Formatting Toolbar** — Single consolidated toolbar at top of notes panel; applies to focused element  

All notes session management and formatting features now complete. Users can:
- Create and manage multiple note sessions
- Search within a session and quickly find verses/notes
- Switch between sessions via sidebar
- Format text (B/I/U, font family, font size, lists, indent) from a single global toolbar
- Resize notes panel width via drag handle
- Export notes as TXT, DOCX, or PDF

---

## Pending Work

### Homepage (index.html) CRO
- [ ] Hero CTA: change button label from "Service Times" → "Join Us This Sunday"
- [ ] Phone number in nav (desktop) / below hero CTAs (mobile) — **need actual number from client**
- [ ] Real congregation photo — group photo after Sunday service, hero background or full-width strip
- [ ] "Your First Visit" section — service length, dress, parking, children's program
- [ ] Hero tagline rewrite — current is too abstract; **need founding year from client**
- [ ] Bible reader callout card on homepage

### Contact / Enquiry Form
- Currently no backend — highest CRO priority for curious visitors
- Recommended: Formspree or EmailJS (no server needed)

### Bible Reader — Feature Queue
- [ ] **Multiple named bookmarks** — currently saves one position only; add named localStorage bookmarks (e.g. "Sunday sermon", "Home study")
- [ ] **Copy shareable link** — URL hash deep-linking (`#John.3.16`) works but no copy button; add to selection toolbar
- [ ] **Verse-level notes** — short personal note per verse, `{ref: text}` in localStorage
- [ ] **Reading plans** — 365-day or curated plans (NT in 90 days, etc.), daily tracker in localStorage
- [ ] **Print stylesheet** — nav and controls currently print; add `@media print` to output passage only
- [ ] **Search streaming** — full JSON load on first search can stall on slow devices; consider chunked iteration with `setTimeout` yield

### Translations to Consider Adding

From `seven1m/open-bibles` — all public domain, converter at `SCRIPTS/zefania-to-json.js`:
- **BBE** (Bible in Basic English) — dynamic equivalence, simple vocabulary, good for new readers
- Others available: WEB-BE, OEB-US, OEB-CW, DRA (Catholic/Vulgate-based)

---

## File Locations

```
coc-website/
├── index.html                  Landing page
├── bible-reader.html           Bible study app (main file, ~5000 lines)
├── service-worker.js           PWA cache — bump version on every html change (now v12)
├── manifest.json               PWA manifest
├── HANDOVER.md                 This file
├── favicon.ico / *.png         Favicons
├── og_banner.jpg               Open Graph preview image
├── .gitignore                  Ignores source/working directories
├── README.md                   Project README
├── Translations & Reference Data (all deployed to root for fetching):
│   ├── kjv.json / asv.json / web.json / ylt.json / lsv.json / lxxe.json / rvr09.json / darby.json
│   ├── kjvs.json / asvs.json  (KJV/ASV + Strong's numbers)
│   ├── hebrew.json / greek-nt.json  (Original languages)
│   ├── adam-clarke.json / matthew-henry.json / jamieson-fausset-brown.json  (Commentaries)
│   ├── eastons.json / smiths.json  (Dictionaries)
│   └── crossrefs.json          (Cross-references for all 66 books)
├── Working/Source Directories (gitignored):
│   ├── BIBLE TRANSLATIONS/     Source files for all translation JSONs
│   ├── COMMENTARIES/           Source files & scripts for commentary data
│   ├── DICTIONARY/             Source files for dictionary data
│   ├── SCRIPTS/                Node.js converters (zefania-to-json.js, etc.)
│   ├── BRAND/                  Logo assets
│   ├── LIBRARY/                E-book conversion scripts
│   └── ARCHIVES/               Versioned snapshots of bible-reader.html
└── .git/                       Git repository
```

---

## Deployment Checklist

Before pushing any change to `bible-reader.html`:
1. Bump service worker: `service-worker.js` line 7, `coc-bible-vN` → `coc-bible-v(N+1)`
2. `git add bible-reader.html service-worker.js [any new .json files]`
3. `git commit -m "fix/feat(bible-reader): ..."`
4. `git push origin <branch>` then open a PR — branch protection requires PRs on `master`
5. Merge PR → deploy triggers automatically
6. `gh run watch <run-id>` — confirm green
7. Hard-refresh on device to force SW update

For `index.html` changes, no service worker bump needed.

---

## Translation Addition Workflow

To add a new public-domain translation from `seven1m/open-bibles`:

```powershell
# 1. Download the XML
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/seven1m/open-bibles/master/<filename>.xml" `
  -OutFile "BIBLE TRANSLATIONS/<filename>.xml"

# 2. Convert to JSON
node SCRIPTS/zefania-to-json.js "BIBLE TRANSLATIONS/<filename>.xml" "<key>.json"

# 3. Copy to repo root (reader fetches from root)
Copy-Item "BIBLE TRANSLATIONS/<key>.json" "<key>.json"
```

Then in `bible-reader.html`:
- `TRANSLATIONS` object — add `key: 'Label'`
- `TRANSLATION_ABBR` — add `key: 'ABBR'`
- `LOCAL_TRANSLATIONS` — add `'key'` to the Set
- Translation dropdown HTML (×2 — main selector and parallel selector)
- Hidden `<select>` — add `<option>`
- Bump service worker version
