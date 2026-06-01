# COC Website — Handover File

*Last updated 2026-06-01 (session 18)*

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
- **Service worker (`service-worker.js`)** — PWA offline support for `bible-reader.html`, cache version `coc-bible-v15`
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

Cache version is `coc-bible-v34`. **Bump this on every deploy that changes `bible-reader.html`** — otherwise returning visitors on mobile get stale cached files.

Location: `service-worker.js`, line 7: `const CACHE = 'coc-bible-v34';`

### Dark Mode

- Toggle via settings gear in toolbar → "Dark Mode"
- Persists to localStorage as `bibleTheme`
- All colors respond to `[data-theme="dark"]` CSS selector
- Page wrap applies theme on page load via inline script (line 6)

---

## Session Work — 2026-05-25 (session 15, continued)

### Adam Clarke Commentary — Mobile JSON Error Fix

**PR #38** — `fix/commentary-mobile-json` → merged to `master` → deployed (coc-bible-v21)

**Bug:** Selecting Adam Clarke (or any of the 3 built-in commentaries) on mobile showed "unexpected token" in the commentary panel. Desktop appeared fine because the browser HTTP cache had a previous valid response.

**Root cause:** `loadCommentaryChapter` always fetched from `bible.helloao.org/api/c/adam-clarke/...`. The API was returning an HTML error page (HTTP 200 but non-JSON body). `res.json()` threw `SyntaxError: Unexpected token '<'`, which was caught and displayed as a raw error string.

**Fix:**
- Added `LOCAL_COMMENTARIES = new Set(['adam-clarke','matthew-henry','jamieson-fausset-brown'])` and `LOCAL_COMMENTARY_FULL = {}` (in-memory cache for full parsed JSON)
- `loadCommentaryChapter` now loads `/{key}.json` from the site root for these three commentaries; slices `data[bookName][chapter]` (format already matches what `renderCommentaryPassage` expects)
- Full parsed object cached in `LOCAL_COMMENTARY_FULL[key]` — chapter navigations after the first are instant
- Added `Content-Type` guard before `res.json()` on the helloao path (john-gill, keil-delitzsch, tyndale) for cleaner error messages
- Service worker bumped v20 → v21

**First-load file sizes (then SW-cached for subsequent visits):**

| Commentary | File size |
|-----------|-----------|
| Adam Clarke | 11.8 MB |
| Matthew Henry | 29.9 MB |
| Jamieson-Fausset-Brown | 9.0 MB |

---

## Session Work — 2026-05-25 (session 15)

### Pill Menu Layout Bug Fixes

**PR #37** — `fix/pill-menu-bugs` → merged to `master` → deployed (coc-bible-v20)

| Bug | Root cause | Fix |
|-----|-----------|-----|
| Translation dropdown overflows left on mobile | `.pill-dropdown` uses `left: 50%; transform: translateX(-50%)` relative to the button wrapper — on mobile this pushes the list off the left edge | Added `@media (max-width: 640px)` override: `position: fixed; left/right: 0; bottom: 0` — slides up as bottom sheet |
| Vestigial partition in Parallel & Commentary rows | `.pill-study-arrow` had `border-left: 1px solid var(--line)` with no content inside the button — showed as a bare divider | Removed `border-left`; added a small `›` chevron SVG inside each arrow button |
| Commentary & Parallel sub-menus overflow left on mobile | Desktop rule `#study-dropdown-menu .parallel-dropdown-menu { right: calc(100%+4px) }` has higher specificity than the generic `.parallel-dropdown-menu` mobile rule, so sub-menus ignored the fixed-sheet override | Added `#study-dropdown-menu .parallel-dropdown-menu` to the mobile selector with `!important` so all sub-menus slide up from bottom |
| Settings menu had no close button; fonts unsorted | No close affordance existed; font options were in session-addition order | Added "Settings" header row with ✕ close button; fonts sorted alphabetically (Atkinson → OpenDyslexic) |

**Files modified:**
| File | Changes |
|------|---------|
| `bible-reader.html` | 50 insertions, 15 deletions — CSS, HTML, settings header, font order |
| `service-worker.js` | Cache version bump only (v19 → v20) |

---

## Session Work — 2026-05-25 (session 14)

### Mobile UI Bug Fixes

**PR #35** — `fix/mobile-ui-bugs` → merged to `master` → deployed (coc-bible-v19)

**Bug 1 — Verse selection bar overflow (mobile)**

The pill that appears when selecting verses was overflowing both edges of the screen on mobile.

| Change | Detail |
|--------|--------|
| Removed verse-count label | "1 verse selected" span eliminated; label served no useful purpose in a compact bar |
| Dividers between all items | `sel-divider` now appears between every button, not just around Clear |
| "Clear" → "✕" close button | `.sel-btn-close` replaces the text "Clear" for compactness |
| Share button added | New `selectionShare()` function — uses Web Share API (native OS sheet) on mobile, falls back to the existing share modal (X / WhatsApp / Facebook / Copy) on desktop |
| Overflow fix | `max-width: calc(100vw - 20px)` prevents the bar escaping the screen; padding and font reduced at ≤540px |

**Bug 2 — Book name overflows top header on mobile**

`renderPassage()` now sets `passage-ref-top` using `BOOK_ABBR` when `window.innerWidth <= 540` (e.g. "2 Thessalonians" → "2 Thess"). Full name is still used on tablet and desktop.

**Bug 3 — Study button blank in bottom pill nav (mobile)**

On mobile the pill renders in two tiers. The second tier (`.pill-tools`) had `justify-content: flex-end` which pushed items right, and `.pill-study-text { display: none }` hid the "Study" label, leaving a blank gap between two dividers. Fixed by:
- Removing the `display: none` on `.pill-study-text` (Study label now visible on mobile)
- Changing `.pill-tools` to `justify-content: space-between` so all items distribute evenly across the full row width

**Files modified:**
| File | Changes |
|------|---------|
| `bible-reader.html` | 51 insertions, 19 deletions — CSS, HTML, `updateSelectionBar`, new `selectionShare`, `renderPassage` book abbr |
| `service-worker.js` | Cache version bump only (v18 → v19) |

---

## Session Work — 2026-05-25 (session 13)

### Social Media Verse Sharing

**PRs #28–#33** — `feat/verse-share` + four fix/bump PRs → merged to `master` → deployed (coc-bible-v18)

**Feature:** Right-click any verse number → context menu now includes **Share verse**.

| Path | Behaviour |
|------|-----------|
| Mobile / Web Share API supported | OS native share sheet (covers WhatsApp, Facebook, X, Messages, etc. in one tap) |
| Desktop / fallback | Modal with branded buttons: X (Twitter), WhatsApp, Facebook, Copy to clipboard |

Shared content format: `"verse text" — Book Chapter:Verse (ABBR)\nURL#Book.Chapter.Verse`

**Root-cause bug hunt (4 rounds):**

| Round | Symptom | Root cause | Fix |
|-------|---------|------------|-----|
| 1 | Verse text = "null" string | `raw.t !== undefined` passes when `raw.t === null`; template literal renders null as "null" | `raw.t != null` in `getVerseText`; `|| ''` in `ctxShare` |
| 2 | Still "null" | `fetchLocalChapter` also uses `!== undefined`, passing null t-values to render | `val.t != null ? val.t : ''` in `fetchLocalChapter`; `v.text != null` in all 3 render paths |
| 3 | Still "null" | `stripHtml(null)` sets `tmp.innerHTML = null` which browser serialises as the string `"null"` | Early-return guard `if (!html) return ''` in `stripHtml` |
| 4 | Still "null" | **Actual root cause:** `ctxShare()` calls `hideVerseCtxMenu()` before using `ctxVerseNum`. `hideVerseCtxMenu()` sets `ctxVerseNum = null`, so ref and `getVerseText` both receive null | Snapshot `const verseNum = ctxVerseNum` before calling `hideVerseCtxMenu()` |

**Lesson:** Always snapshot shared mutable state into a local `const` at the top of a handler before calling any function that might reset it.

**Service worker:** `coc-bible-v16` → `coc-bible-v18` (bumped twice — should have been once with the feature PR)

**Files modified:**
| File | Changes |
|------|---------|
| `bible-reader.html` | Share modal CSS + HTML, `ctxShare` + 5 helper functions, context menu button, null guards in `stripHtml` / `fetchLocalChapter` / render paths |
| `service-worker.js` | v16 → v18 |

---

## Session Work — 2026-05-24 (session 12)

### Nav Pill Redesign — Grid-Only Navigation & Compact Layout

**PR #24** — `feat/pill-nav-redesign` → merged to `master` → deployed (coc-bible-v15)
**PR #25** — `chore/sw-bump-v15` → merged to `master` → deployed (service worker bump)

**Navigation overhaul:**

| Change | Detail |
|--------|--------|
| Chapter & verse dropdowns removed | Grid picker is now the sole nav mechanism for chapter and verse |
| Book dropdown always triggers grid | `onmousedown` saves and blanks the value so re-selecting the same book fires `onchange` and opens the chapter grid; `onblur` restores if dismissed without picking |
| Same-book re-selection | When already on John 3 and user opens Book → picks John again, chapter grid opens with current chapter highlighted |
| Bottom nav stripped | Arrow buttons removed from `#bottom-nav`; now a centred strip showing translation full name + ⓘ info button only |
| Chevrons merged into pill | `«` `‹` `›` `»` moved into `.pill-nav` flanking the book select, reusing the `-bot` IDs so all JS sync logic (`syncHistoryBtns`, prev/next disable) works unchanged |

**SVG chevrons:**

All four chevrons in both the pill and the top nav are now matched SVGs — same arm geometry (`polyline points="14 3 9 12 14 21"` / mirrored), `stroke-width="2.5"`, `width="16" height="16"`. Replaced Nunito Unicode glyphs which had inconsistent stroke weight. `nav-arrow-btn` and `nav-hist-btn` updated to `display:flex` for proper centering.

**Pill polish:**

| Item | Detail |
|------|--------|
| Filter icons | `▾` replaced with 3-line SVG filter icon on Translation, Study, Parallel sub-arrow, Commentary sub-arrow (menus open upward) |
| Book select caret | CSS `::after` `▾` removed — native select has no indicator |
| Compact pill | `.pill-nav` changed to `flex:none`; pill drops fixed `width`; shrinks to content, stays centred via `translateX(-50%)` |
| Book select width | `.pill-location` and `.pill-select` set to `flex:none` / `width:auto` — sizes to longest option ("2 Thessalonians") |
| Study/Settings divider | `pill-divider` added between Study and Settings buttons |
| Scroll-to-top on mobile | Added `@media (max-width:540px) { bottom:140px }` to clear the two-row pill layout |

**Files modified:**
| File | Changes |
|------|---------|
| `bible-reader.html` | 57 insertions, 54 deletions |
| `service-worker.js` | Cache version bump only (v14 → v15) |

---

## Session Work — 2026-05-24 (session 11)

### Critical Load Fix — History Nav Script Order

**PR #22** — `fix/history-load-order` → merged to `master` → deployed

**Bug:** Bible reader showed a permanent loading spinner in Chrome and Firefox after PR #19 was deployed.

**Root cause:** `historyPush()` and `syncHistoryBtns()` were defined in the second `<script>` block (notes/settings, ~line 6700), but called inside `renderPassage()` which fires in the first `<script>` block on initial page load. The browser threw a `ReferenceError` before any verses could render.

**Fix:** Moved the history state variables (`readingHistory`, `historyIndex`, `_histNavActive`) and those two functions into the main script block immediately before the initial `renderPassage()` call. `historyBack()` and `historyForward()` remain in the second block as they are only triggered by user interaction.

**Files modified:** `bible-reader.html` (37 insertions, 36 deletions — move only, no logic change)

---

## Session Work — 2026-05-24 (session 10)

### WEB Translation Data Fix — 2 John & 3 John

**PR #20** — `fix/web-json-2john-3john` → merged to `master` → deployed

**Bug:** In the WEB translation, 2 John showed only 1 verse and 3 John showed only 1 verse. Verse grid showed only v1.

**Root cause:** The `web.json` was converted from a Zefania XML source. The WEB source is actually in USFX format (`<v id="N"/>text<ve/>`), not Zefania (`<v>text</v>`). The converter matched only the opening tag and captured nothing after it, leaving just verse 1 in each single-chapter book where the paragraph structure exposed the issue.

**Fix:** Re-extracted from `BIBLE TRANSLATIONS/eng-web.usfx.xml` using a USFX-aware regex. Results:
- 2 John: 1 verse → **13 verses** ✅
- 3 John: 1 verse → **14 verses** ✅

**Full audit:** All other books checked against KJV verse counts. Two remaining shortfalls found and confirmed as **intentional WEB text choices**, not bugs:
- Acts 24:7 — WEB marks this verse as a Textus Receptus addition only (footnote, no verse text); correctly absent
- Romans 16 (25 vs 27 verses) — the WEB source itself omits the repeated benediction and places the doxology differently per its manuscript tradition

**Files modified:** `web.json` (1 insertion, 1 deletion — two book entries patched)

---

## Session Work — 2026-05-24 (session 9)

### UI Polish, New Fonts, Sepia Theme & Session History Nav

**PR #19** — `feat/bible-reader-ui-session-9` → merged to `master` → deployed (coc-bible-v14) ⚠️ introduced load bug fixed in PR #22

**Features:**

| Feature | Description |
|---------|-------------|
| Session history nav | `«`/`»` buttons alongside chapter chevrons. Browser-style back/forward across passages visited in the session. Tooltips show destination (e.g. `← Job 3`). History stack lives in memory, resets on reload. |
| Sepia theme | Warm cream/brown palette. `📜 Sepia` button in reader toolbar. Persists to localStorage. Inline restore script handles all three themes (light/dark/sepia). |
| Notes text colour picker | `<input type="color">` added to notes formatting toolbar. Uses `foreColor` execCommand. |
| Reading fonts expanded | Added Merriweather, Inter, Atkinson Hyperlegible. Picker now has 9 options ordered by readability tier. New Google Fonts loaded in `<head>`. |
| Notes font picker | Replaced system fonts (Comic Sans, Verdana etc.) with the curated reading font list. |

**Polish:**

| Item | Description |
|------|-------------|
| Chapter chevrons | `←`/`→` → `‹`/`›` at 1.8rem on all 4 nav buttons. History `«`/`»` visually muted at rest to distinguish function. |
| Notes back button | `← Reader` → `‹ Reader` |
| Search filter alignment | Labels get `min-width: 72px; text-align: right` — all dropdowns share a consistent left edge. |
| BC/AD | `BCE` → `BC`, `CE` → `AD` throughout book info data and manuscript descriptions. |

**Service worker:** `coc-bible-v13` → `coc-bible-v14`

**Files modified:**
| File | Changes |
|------|---------|
| `bible-reader.html` | 250 insertions, 97 deletions |
| `service-worker.js` | Cache version bump only |

---

## Session Work — 2026-05-24 (session 8)

### Bug Fixes, Grid Navigation & Notes Overhaul

**PR #17** — `fix/bible-reader-bugs-and-grid-nav` → merged to `master` → deployed (coc-bible-v13)

**Bug fixes:**

| # | Bug | Fix |
|---|-----|-----|
| 1 | Scroll-to-top chevron overlapping bottom nav pill on tablet | Extended `bottom: 80px` rule to all viewports ≤900px |
| 2 | Commentary sub-dropdown spilling off right edge of screen when Study mode active | Changed sub-dropdown to open **left** (`right: calc(100% + 4px)`) instead of right |
| 3 | No way to clear word search field | Added `×` clear button with `clearSearchInput()` — resets field and results |
| 4 | Floating book/translation reminder pill top edge clipped by fixed header | Raised all three floating pills: `top: 80px → 88px` (desktop), `top: 68px → 80px` (mobile) |
| 5 | Chapter/verse dropdowns intermittently transparent during navigation | `.pill-select` now has explicit solid background (`#ffffff` / `#2a2a25` dark) instead of `transparent` |
| 6 | `renderPassage` silently hangs on network failure | Catch block now detects offline state, shows specific message, and renders a **Try Again** button |

**Features:**

| Feature | Description |
|---------|-------------|
| Notes full-page view | Notes panel converted from right sidebar to full-screen page. `← Reader` back button in topbar. Resize handle removed. Content centred at max 860px for readability. `setNotesPanelWidth` made no-op; stale saved width cleared on open. |
| Grid chapter/verse picker (primary nav) | Olive Tree-style: selecting a book opens a floating chapter grid modal. Selecting a chapter fetches the passage then opens a verse grid. Selecting a verse scrolls to it. Escape key closes both grids. Existing pill dropdowns remain as secondary nav. Backdrop click also closes. |

**Quick wins:**
- Removed 4 `console.log` statements from production (lines 3366, 5218, 5223, 5232)
- Service worker bumped: `coc-bible-v12` → `coc-bible-v13`

**Files modified:**
| File | Changes |
|------|---------|
| `bible-reader.html` | 215 insertions, 75 deletions |
| `service-worker.js` | Cache version bump only |

**Deployment:**
- Commit: `033325c` — squash-merged via PR #17
- GitHub Actions deployment completed successfully
- Live at `toddsroadcoctt` ✅

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
| 🔴 HIGH | Missing error handling on `fetch()` calls | App hangs on network failure; no user feedback | 2 hrs | ✅ Done (session 8) |
| 🟠 MEDIUM | 210+ repeated `getElementById()` calls; no DOM caching | 20-30% slower interaction response time | 1-2 hrs | Not started |
| 🟠 MEDIUM | Event listeners never cleaned up on navigation | Memory leak; slowdown after 20+ navigations on mobile | 2 hrs | Not started |
| 🟠 MEDIUM | Interlinear mode loads entire 30MB JSON file into memory | Can crash low-end mobile devices | 3 hrs | Not started |
| 🟠 MEDIUM | No request cancellation on rapid navigation | Stale data can overwrite current view; wasted bandwidth | 1-2 hrs | Not started |
| 🟡 LOW-MEDIUM | Browser compatibility gaps (backdrop-filter, CSS variables) | Limited support in older/enterprise browsers | 2 hrs | Not started |
| 🟡 MEDIUM | Accessibility: missing ARIA labels, keyboard navigation | Screen reader users can't navigate; poor keyboard UX | 4 hrs | Not started |
| 🟡 LOW | `console.log()` statements left in production | Minor (debug noise, data exposure) | 0.5 hrs | ✅ Done (session 8) |

### Quick Wins (Low effort, immediate improvement)
1. ~~**Remove console.log statements**~~ — ✅ Done (session 8)
2. ~~**Add user-friendly error messages** for failed chapter/search loads~~ — ✅ Done (session 8)
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
- Open Notes as a full-screen page and return to the reader via ← Reader
- Export notes as TXT, DOCX, or PDF

---

## Session Work — 2026-06-01 (session 18)

### Verse Highlight & Underline Picker Redesign

**PR #59** — `feat/verse-highlight-underline` → merged → `coc-bible-v37`

**Feature:** Replaced the bare 4-swatch colour row with a full two-mode picker panel.

| Change | Detail |
|--------|--------|
| Mode toggle | `● Highlight` / `U̲ Underline` at top of picker — either/or |
| 5 colours | Yellow, green, blue, pink, orange (orange added) |
| Underline options | Style: solid / dotted / wavy; Weight: thin / medium / thick; defaults: solid medium |
| Mobile layout | Picker renders as a bottom sheet on ≤640px |
| Batch apply | "Highlight" button in selection bar — opens picker and applies to all selected verses |
| Picker memory | Re-opening on a marked verse pre-selects correct mode, colour, style and weight |

**Supabase migration:** `highlights` table extended — `style TEXT DEFAULT 'highlight'`, `ul_style TEXT`, `ul_weight TEXT`

**CSS approach:** Underline uses `text-decoration: underline <style> <color> <thickness>` on `.verse-text` spans via compound classes (`ul-blue-wavy-thick`, etc.). 45 underline classes × 5 colours = all combinations pre-declared.

**Data model:** `HIGHLIGHT_CACHE` values upgraded from plain colour strings to `{color, style, ulStyle, ulWeight}` objects. `applyHighlightsToPage` builds compound class names dynamically.

**Sub-verse text selection** — deferred to next session.

---

## Session Work — 2026-05-31 (session 16)

### Dictionaries
- **PR #46** — `feat/hitchcock-dictionary` → merged → `coc-bible-v26`
  - Added `hitchcock.json` (~2,600 name meanings, public domain 1869)
  - Refactored Study menu Dictionary row to arrow-dropdown pattern (matching Commentary/Parallel)
  - Sub-menu lists Easton's, Smith's, Hitchcock's
- `build-hitchcock.mjs` and `build-fausset.mjs` are at repo root (gitignored)
- `fausset.json` not yet built — `build-fausset.mjs` scrapes bible-history.com; bug fixed (entries now keyed from URL slug). Run `node build-fausset.mjs` from `coc-website/` to generate (~20 min). Once done, add `fausset` to `LOCAL_DICTIONARIES`, `DICT_SOURCE_NAMES`, and the dictionary dropdown HTML, then PR.

### Swipe Navigation
- **PR #47** — `feat/swipe-chapter-nav` → merged → `coc-bible-v27`
  - Swipe left = next chapter, swipe right = previous chapter on mobile
  - Passive touch listeners on `#verses-area` only; 60px min horizontal, 1.5× H:V ratio guard

### Verse Highlights + Auth (PRs #48–54)
- **PR #48** — `feat/verse-highlights` → merged → `coc-bible-v28`
  - Right-click verse number (desktop) or long-press (mobile) → colour picker (yellow, green, blue, pink, ✕ remove)
  - Supabase project `COC Website` created (`bxdenfhpmbsxvaqoxyei`, us-east-1)
  - `highlights` table with RLS (`user_id, book, chapter, verse, color`); unique on `(user_id, book, chapter, verse)`
  - Anonymous session created silently on first visit — highlights work with no sign-in required
  - Settings → Account section: sign in/up (email+password), Google OAuth, forgot/reset password, sign out
- **PRs #49–54** — series of auth UI fixes:
  - `--card` → `--white` (modal was transparent)
  - `--border` → `--line` (input borders were invisible)
  - Form field spacing and button margin
  - `updateAuthUI` robust signed-in detection (checks `email` + `identities`, not just `is_anonymous`)
  - Auth init race condition fixed: `onAuthStateChange`-first approach; anonymous fallback deferred 1s

### Google OAuth
- Google Cloud project: `coc-website`; OAuth client: `Web client 1` (Web application)
- Authorized JS origin: `https://toddsroadcoctt.org`
- Redirect URI: `https://bxdenfhpmbsxvaqoxyei.supabase.co/auth/v1/callback`
- Supabase Site URL: `https://toddsroadcoctt.org/bible-reader.html`
- App is in **testing mode** — add users at Google Cloud → Audience → Test users
- To open to all church members: Google Cloud → Audience → Publish app

**Current SW version: `coc-bible-v37`**

---

## Session Work — 2026-05-31 (session 17)

### Google Sign-In Feedback & Auth Race Condition Fix

**PR #56** — `fix/auth-signin-feedback` → merged → `coc-bible-v35`
- Added `#auth-toast` — green pill slides in from top after successful sign-in showing "Signed in as user@example.com ✓", auto-dismisses after 3.5s
- `onAuthStateChange` now calls `closeAuthModal()` on `SIGNED_IN` so any open modal is dismissed

**PR #57** — `fix/auth-real-user-guard` → merged → `coc-bible-v36`

**Root cause of "Browsing anonymously" after Google sign-in:**
After OAuth redirect, Supabase fires `SIGNED_OUT` for the old anonymous session *after* `SIGNED_IN` for the real Google user. The 1-second anonymous fallback timer was being restarted by that `SIGNED_OUT` event, causing `signInAnonymously()` to run and overwrite the real user.

**Fix:** Added `hasRealUser` flag:
- Set to `true` once any non-anonymous user authenticates
- While `hasRealUser` is true, null-session events skip the anonymous fallback entirely
- Double-checked inside the timer callback
- Reset to `false` in `signOut()` so anonymous browsing resumes correctly after explicit sign-out

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
- [x] **Social media sharing** — right-click any verse → Share verse; Web Share API on mobile, modal (X/WhatsApp/Facebook/copy) on desktop ✅ Done (session 13)
- [x] **Share from selection bar** — selecting verses → Share button in selection bar; same Web Share / modal fallback ✅ Done (session 14)
- [x] **Swipe chapter navigation** — swipe left/right on passage to advance/go back ✅ Done (session 16, PR #47)
- [x] **Verse highlights** — right-click/long-press → colour picker; persisted to Supabase ✅ Done (session 16, PRs #48–54)
- [x] **Highlight/underline picker redesign** — two-mode card panel; 5 colours; underline style+weight options; mobile bottom sheet; batch apply from selection bar ✅ Done (session 18, PR #59)
- [x] **Hitchcock's Bible Names dictionary** — added as local dictionary source ✅ Done (session 16, PR #46)
- [ ] **Fausset's Bible Dictionary** — `build-fausset.mjs` ready; run it to generate `fausset.json`, then wire into UI
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
├── service-worker.js           PWA cache — bump version on every html change (now v19)
├── manifest.json               PWA manifest
├── handoff.md                  This file
├── favicon.ico / *.png         Favicons
├── og_banner.jpg               Open Graph preview image
├── .gitignore                  Ignores source/working directories
├── README.md                   Project README
├── Translations & Reference Data (all deployed to root for fetching):
│   ├── kjv.json / asv.json / web.json / ylt.json / lsv.json / lxxe.json / rvr09.json / darby.json
│   ├── kjvs.json / asvs.json  (KJV/ASV + Strong's numbers)
│   ├── hebrew.json / greek-nt.json  (Original languages)
│   ├── adam-clarke.json / matthew-henry.json / jamieson-fausset-brown.json  (Commentaries)
│   ├── eastons.json / smiths.json / hitchcock.json  (Dictionaries — fausset.json pending)
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
1. Bump service worker — **always read the version from `origin/master`, not the local file**, to avoid merge conflicts when multiple PRs are open:
   ```bash
   git fetch origin master
   current=$(git show origin/master:service-worker.js | grep -oP "coc-bible-v\K\d+")
   sed -i "s/coc-bible-v[0-9]*/coc-bible-v$((current + 1))/" service-worker.js
   ```
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
