# COC Website — Handover File
*Last updated 2026-05-13*

---

## Project Overview

Single-page church website for the Church of Christ at Todd's Road, Trinidad.
Two deployable files: `index.html` (landing page) and `bible-reader.html` (full Bible study app).

**Live URL:** toddsroadcoctt (GreenGeeks cPanel)
**GitHub repo:** `brandonr2630/coc-website`
**Deploy:** every push to `master` auto-deploys via GitHub Actions → cPanel Git Version Control API.

---

## Tech Stack

- Vanilla HTML / CSS / JS — no build system, no framework, no npm
- Supabase: not yet used on this site (ERP only)
- Service worker (`service-worker.js`) — PWA offline support, currently `coc-bible-v11`
- Translation JSON files served from repo root (fetched client-side on first use, then cached)

---

## Bible Reader Architecture (`bible-reader.html`)

### Translations
| Key | Label | Source | Notes |
|-----|-------|--------|-------|
| `nkjv` | New King James Version | bolls.life API | Copyright — API only, never cached locally |
| `kjv` | King James Version | `kjv.json` | Public domain |
| `asv` | American Standard Version | `asv.json` | Public domain |
| `web` | World English Bible | `web.json` | Public domain |
| `ylt` | Young's Literal Translation | `ylt.json` | Public domain |
| `lsv` | Literal Standard Version | `lsv.json` | Public domain |
| `lxxe` | English Septuagint (1851) | `lxxe.json` | Public domain |
| `rvr09` | Reina-Valera 1909 | `rvr09.json` | Public domain |
| `darby` | Darby Bible (1890) | `darby.json` | Public domain |
| `kjvs` | KJV + Strong's | `kjvs.json` | Public domain |
| `asvs` | ASV + Strong's | `asvs.json` | Public domain |
| `hebrew` | Hebrew OT | `hebrew.json` | Leningrad Codex — free with citation |
| `greek-nt` | Greek NT | `greek-nt.json` | Public domain |

`LOCAL_TRANSLATIONS` = all except `nkjv`. `STRONGS_TRANSLATIONS` = `{kjvs, asvs}`.

### Key JS globals
- `currentBook`, `currentChapter`, `currentTranslation`, `currentUser`, `currentCompany`
- `BIBLE_CACHE` — lazily populated per-translation on first load/search
- `BOOKS` — array of `{name, chapters, testament}` for all 66 books
- `TRANSLATION_ABBR` — short labels for pill button (e.g. `nkjv → 'NKJV'`, `darby → 'DARBY'`)
- `BOOK_ABBR` — 66-book short names used on mobile ≤540px (e.g. `Genesis → 'Gen'`)

### UI Layout

The page has three zones:
1. **Top nav** — logo left, hamburger right. All nav links are behind the hamburger overlay.
2. **Page wrap** — Bible text is the dominant element. Large serif font, generous line height.
3. **Reader pill** — `position: fixed` floating bar at bottom of viewport.

### Reader Pill

The pill holds all navigation and study controls in one bar:

```
[ OT | NT ]  [ Book ▾ | Ch ▾ | V ▾ ]  [ NKJV ▾ ]  [ Study ▾ ]  [ ⚙ ]
```

On mobile (≤540px) the pill wraps to **two rows**:
- Row 1: `OT | NT | Book ▾ | Ch ▾ | V ▾` (full width)
- Row 2: `NKJV ▾ | Study ▾ | ⚙` (right-aligned)

Key CSS:
- `.reader-pill` — `position:fixed; bottom:20px; border-radius:50px` (16px on mobile)
- `.pill-nav` — flex:1, holds OT/NT + location selects
- `.pill-tools` — flex-shrink:0, holds translation/study/settings
- `.pill-divider-desktop` — the divider between pill-nav and pill-tools; hidden on mobile
- `.pill-dropdown` — opens upward via `bottom: calc(100% + 14px)`
- `#study-dropdown-menu .parallel-dropdown-menu` — sub-menus anchor `bottom:0; top:auto` (open upward)
- `body.reading-mode .reader-pill` — `display:none` (pill hidden in Reading Mode)

The pill is hidden in Reading Mode and Presentation Mode.

### Panels (all `position: fixed`)
| Panel | Trigger | Desktop position | Mobile position |
|-------|---------|-----------------|----------------|
| Search | 🔍 button in nav | Left side, 360px wide | Bottom sheet, draggable, 3 snaps |
| Strong's | tap word in KJV+S/ASV+S | Right side, 360px wide | Bottom sheet |
| Notes | 📝 in Study menu | Right side, 380px wide | Bottom sheet |
| X-ref | click verse cross-ref icon | Left side, 320px wide | Bottom sheet |

### Search panel (word search)
- `performSearch()` — two paths: bolls.life API (NKJV) or local JSON scan
- Filters: Testament / Section / Book / Strong's # (Strong's # only visible for kjvs/asvs)
- Results paginated at 25 per page (`SEARCH_PAGE_SIZE`), state in `searchResultsCache` / `searchCurrentPage`
- Mobile drag handle: 3 snap heights — 180px (compact), 55vh (default), 85vh (expanded)
- `--search-pb` CSS variable on `:root` drives `page-wrap` padding-bottom dynamically

### Service worker
Cache version is `coc-bible-v11`. **Bump this on every deploy that changes `bible-reader.html`** — otherwise returning visitors on mobile get a stale cached file.

Location: `service-worker.js`, line 7: `const CACHE = 'coc-bible-v11';`

### Notes / Sermon Notes feature
- Data model: `coc_notes_sessions` in localStorage
- Right-click any verse → "Add to Notes"; or use selection bar → Notes button
- Export: TXT, DOCX (docx.js lazy-loaded from CDN), PDF (window.print)
- Rich-text toolbar on note cards: bullet list / numbered list / indent

---

## Session Work — 2026-05-13

### Commits in this session
| Hash | Summary |
|------|---------|
| `62264f3` | Add .gitignore and HANDOVER.md; untrack source-only folders |
| `74b71e1` | refactor(bible-reader): floating pill nav, slim top bar, larger text |
| `bc81fbf` | fix(bible-reader): pill contrast, full-width layout, Ch/V labels, mobile abbr |
| `afe0495` | fix(bible-reader): pill 2-row mobile layout, bigger font, translation abbr, upward sub-menus |

### Details

**Floating pill nav (74b71e1)**
Replaced the 4-row controls block with a single floating pill bar at the bottom of the viewport. OT/NT buttons, Book/Chapter/Verse selects, Translation picker, Study dropdown, and Settings gear all live in the pill. Top nav simplified to logo + hamburger only.

**Pill contrast + layout fixes (bc81fbf)**
- White pill with green border for contrast against the cream page background
- `flex:1` on `.pill-location` so Book/Ch/V occupy all available pill width
- Book select `flex: 2.5`, Ch and V each `flex: 1`
- Chapter options labelled `Ch N`, verse options `V N`
- `BOOK_ABBR` JS object (66 books) renders short names on mobile ≤540px
- Settings/Study dropdowns anchored `right:0` to prevent right-edge overflow
- `TRANSLATION_ABBR` JS object for abbreviated pill labels

**Pill polish — 2-row mobile, bigger font, sub-menu direction (afe0495)**
- Mobile: pill wraps to 2 rows via `flex-direction:column` on `.reader-pill` at ≤540px; `.pill-nav` (row 1) and `.pill-tools` (row 2) each `display:flex`
- Verse select restored on mobile (was hidden; now in row 1 with Book and Chapter)
- Translation button label fixed — `updateTranslationInfo()` and init code now use `TRANSLATION_ABBR[t]` instead of the full `TRANSLATIONS[t]` name
- Study sub-menus (Parallel, Commentary) anchor at `bottom:0; top:auto` so they open upward
- Font 0.72 → 0.82rem; pill padding 5px/10px → 8px/14px; button padding 6px/9px → 8px/11px
- SW bumped to v11

---

## Previous Session Work — 2026-05-12

### Commits
| Hash | Summary |
|------|---------|
| `9146838` | Add Darby Bible (1890) — public domain, from seven1m/open-bibles |
| `398edd5` | Label nowrap fix, search panel drag handle, pagination |
| `9ad8cba` | Label width fix, mobile overlay padding, Strong's # filter |

### Details

**Search panel label fix**
`testament` was clipping on tablet. Fix: replaced `width: 68px` with `white-space: nowrap; flex-shrink: 0` on `.search-filter-label`.

**Mobile overlay fix**
On mobile the search panel is a bottom sheet (max 60vh). `padding-bottom: var(--search-pb, 55vh)` on `.page-wrap` when `body.search-open` on mobile. JS sets `--search-pb` to the actual snapped pixel height.

**Strong's number filter**
- Visible only when translation is `kjvs` or `asvs` (`STRONGS_TRANSLATIONS`)
- Input accepts `3056` or `G3056` — strips H/G prefix before searching
- Searches raw verse text for the embedded digit pattern `[a-zA-Z]<num>(?!\d)`
- `highlightStrongsInVerse()` marks English words carrying that number in results

**Search result pagination**
- 25 results per page; status bar "1–25 of 347 results in KJV"
- `goSearchPage(n)` re-renders from cache — no DOM string escaping needed

**Drag handle — search panel (mobile/tablet)**
- Three snap points: 180px compact, 55vh default, 85vh expanded
- Spring easing: `cubic-bezier(0.34,1.56,0.64,1)` on snap

**Darby Bible (1890)**
- Source: `seven1m/open-bibles` (Zefania XML)
- Converted with `SCRIPTS/zefania-to-json.js` (Node.js)

---

## Pending Work

### Homepage CRO
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
- [ ] **Copy shareable link** — URL hash deep-linking (`#John.3.16`) works but no copy button; add to selection bar
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
COC Website/
├── index.html                  Landing page
├── bible-reader.html           Bible study app (main file, ~5000 lines)
├── service-worker.js           PWA cache — bump version on every html change (now v11)
├── manifest.json               PWA manifest
├── darby.json                  Darby Bible (1890)
├── kjv.json / asv.json / ...   Other translation JSONs (all at root for fetch)
├── adam-clarke.json            Adam Clarke commentary
├── matthew-henry.json          Matthew Henry commentary
├── jamieson-fausset-brown.json JFB commentary
├── eastons.json                Easton's Bible Dictionary
├── smiths.json                 Smith's Bible Dictionary
├── HANDOVER.md                 This file
├── BIBLE TRANSLATIONS/         Working copies of all translation source files (gitignored)
├── SCRIPTS/
│   ├── zefania-to-json.js      Converter: Zefania XML → reader JSON (Node.js)
│   └── zefania-to-json.py      Same converter in Python (requires Python 3)
├── COMMENTARIES/               Source JSON + scripts for commentary data (gitignored)
├── DICTIONARY/                 Source JSON for dictionary data (gitignored)
├── BRAND/                      Logo assets (gitignored)
└── ARCHIVES/                   Versioned snapshots of bible-reader.html (gitignored)
```

---

## Deployment Checklist

Before pushing any change to `bible-reader.html`:
1. Bump service worker: `service-worker.js` line 7, `coc-bible-vN` → `coc-bible-v(N+1)`
2. `git add bible-reader.html service-worker.js [any new .json files]`
3. `git commit -m "fix/feat(bible-reader): ..."`
4. `git push origin master`
5. `gh run watch <run-id>` — confirm green
6. Hard-refresh on device to force SW update

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
- `TRANSLATION_INFO` — add scholarly description block
- Translation dropdown HTML (×2 — main selector and parallel selector)
- Hidden `<select>` — add `<option>`
- Bump service worker version
