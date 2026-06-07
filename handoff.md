# COC Website — Handoff

*Last updated: 2026-06-06 · Session 20 · SW `coc-bible-v47`*

---

## Quick Reference

| Item | Value |
|------|-------|
| Live URL | `https://toddsroadcoctt.org` |
| Bible reader | `https://toddsroadcoctt.org/bible-reader.html` |
| GitHub repo | `brandonr2630/coc-website` |
| Deploy | Push to `master` via PR → GitHub Actions → GreenGeeks cPanel auto-deploys |
| Service worker | `service-worker.js` line 7 · **current: `coc-bible-v47`** |
| Supabase project | `COC Website` · ID `bxdenfhpmbsxvaqoxyei` · region `us-east-1` |
| GreenGeeks secrets | `CPANEL_API_TOKEN`, `CPANEL_HOST` (`https://chi203.greengeeks.net:2083`), `CPANEL_USER` (`terranre`) |
| Google OAuth | Cloud project `coc-website` · Client `Web client 1` · flow: **PKCE** |

> **SW bump rule:** always read the version from `origin/master`, never from the local file.
> ```bash
> git fetch origin master
> current=$(git show origin/master:service-worker.js | grep -oP "coc-bible-v\K\d+")
> sed -i "s/coc-bible-v[0-9]*/coc-bible-v$((current + 1))/" service-worker.js
> ```

---

## Tech Stack

- **Vanilla HTML / CSS / JS** — no build system, no bundler, no npm, no framework
- **Two deployable files:** `index.html` (landing page) · `bible-reader.html` (~8 500 lines — entire app)
- **Service worker** (`service-worker.js`) — PWA offline, cache-first for app shell + JSON data, network-only for `bolls.life` and Google Fonts
- **Supabase** (`@supabase/supabase-js@2`) — highlights persistence + user auth (anonymous + email/password + Google OAuth)
- **External read-only APIs:** `bolls.life` (NKJV, never cached), `bible.helloao.org` (additional commentaries, cached in localStorage)
- **Translation & reference JSON** — all served as static files from repo root, fetched client-side

---

## Architecture

### Translations

| Key | Label | Source | Cached |
|-----|-------|--------|--------|
| `kjv` | King James Version | `kjv.json` | SW + localStorage |
| `asv` | American Standard Version | `asv.json` | SW + localStorage |
| `web` | World English Bible | `web.json` | SW + localStorage |
| `ylt` | Young's Literal Translation | `ylt.json` | SW + localStorage |
| `lsv` | Literal Standard Version | `lsv.json` | SW + localStorage |
| `lxxe` | English Septuagint (1851) | `lxxe.json` | SW + localStorage |
| `rvr09` | Reina-Valera 1909 | `rvr09.json` | SW + localStorage |
| `darby` | Darby Bible (1890) | `darby.json` | SW + localStorage |
| `kjvs` | KJV + Strong's numbers | `kjvs.json` | SW + localStorage |
| `asvs` | ASV + Strong's numbers | `asvs.json` | SW + localStorage |
| `hebrew` | Hebrew OT (Leningrad Codex) | `hebrew.json` | SW + localStorage |
| `greek-nt` | Greek NT | `greek-nt.json` | SW + localStorage |
| `nkjv` | New King James Version | `bolls.life` API | **Never** — copyrighted |

`LOCAL_TRANSLATIONS` = all except `nkjv` · `STRONGS_TRANSLATIONS` = `{kjvs, asvs}`

### Reference Data

All JSON files live at repo root and are fetched on demand:

| File | Content | Size |
|------|---------|------|
| `adam-clarke.json` | Adam Clarke Commentary | 11.8 MB |
| `matthew-henry.json` | Matthew Henry Commentary | 29.9 MB |
| `jamieson-fausset-brown.json` | JFB Commentary | 9.0 MB |
| `eastons.json` | Easton's Bible Dictionary (1897) | — |
| `smiths.json` | Smith's Bible Dictionary (1863) | — |
| `hitchcock.json` | Hitchcock's Bible Names (1869) | ~2 600 entries |
| `crossrefs.json` | Cross-references, all 66 books | — |

`fausset.json` — **pending.** Run `node build-fausset.mjs` from `coc-website/` (~20 min). Then add `fausset` to `LOCAL_DICTIONARIES`, `DICT_SOURCE_NAMES`, and the dictionary dropdown HTML.

Additional commentaries (John Gill, Keil-Delitzsch, Tyndale) still fetched live from `bible.helloao.org` with a `Content-Type` guard.

### Highlights & Auth (Supabase)

**Supabase schema — `highlights` table:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | auto |
| `user_id` | uuid FK → auth.users | RLS-scoped |
| `book` | text | |
| `chapter` | int4 | |
| `verse` | int4 | |
| `color` | text | `yellow\|green\|blue\|pink\|orange` |
| `style` | text | `highlight\|underline` |
| `ul_style` | text | `solid\|dotted\|wavy` |
| `ul_weight` | text | `thin\|medium\|thick` |
| `tags` | text[] | Added session 20 |

Unique constraint on `(user_id, book, chapter, verse)`. Row-Level Security enabled.

**Auth flow:**
- First visit → `signInAnonymously()` (silent, 1-second deferred fallback)
- `hasRealUser` flag prevents the anonymous fallback from firing after a real sign-in
- OAuth: **PKCE flow** — `createClient(..., { auth: { flowType: 'pkce' } })`. `redirectTo: window.location.origin + '/bible-reader.html'`. Google now shows `toddsroadcoctt.org` on the consent screen.
- Google Cloud Console: add `https://toddsroadcoctt.org/bible-reader.html` to **Authorized redirect URIs** · Supabase dashboard: add same URL to **Redirect URLs** *(required for PKCE to work)*
- Google app currently in **testing mode** — add users at Google Cloud → Audience → Test users. To open to all: Audience → Publish app.

**In-memory cache:** `HIGHLIGHT_CACHE` — key `"Book:ch:v"` → `{color, style, ulStyle, ulWeight, tags[]}`. Updated synchronously on user action; Supabase persisted asynchronously.

### Key JS Globals

- `currentBook`, `currentChapter`, `currentTranslation` — view state
- `BIBLE_CACHE` — lazily populated per translation on first load/search
- `BOOKS` — 66-entry array of `{name, chapters, testament}`
- `TRANSLATION_ABBR` — pill button labels (`kjv → 'KJV'`)
- `BOOK_ABBR` — 66-book short names for ≤540px mobile
- `HIGHLIGHT_CACHE` — in-memory highlight store (see above)
- `currentAuthUser` — current Supabase user (anonymous or real)
- `hasRealUser` — prevents anonymous fallback from overwriting a signed-in session

### UI Layout

**Bottom pill nav** (fixed, center-bottom) — Book select, prev/next chapter chevrons, session history `«»`, Translation, Study (Commentary, Parallel, Dictionary, Interlinear, My Highlights, Notes), Settings.

**Control rows** (top of page-wrap):
1. Testament (OT/NT) + Translation
2. Book select (triggers grid picker) + Search icon
3. Font A−/A+ · Reading Mode · Present Mode

**Panels** (all `position: fixed`):

| Panel | Desktop | Mobile |
|-------|---------|--------|
| Search | Left 360px | Bottom sheet, 3 snaps |
| Strong's | Right 360px | Bottom sheet |
| Notes | Full-page view | Full-page view |
| X-ref | Left 320px | Bottom sheet |
| Commentary | Right 400px | Bottom sheet |
| Dictionary | Right 380px | Bottom sheet |
| My Highlights | Right 360px | Bottom sheet, 3 snaps |
| Highlight picker | Near cursor | Bottom sheet |

**Highlight picker** — order: Mode toggle → Tags section → Colour swatches → Underline options. Picker stays open after colour pick so tags can be added immediately. Closes on ✕ swatch, backdrop click, or bulk-apply.

---

## Feature Status

### Completed — Bible Reader

| Feature | Session | PRs |
|---------|---------|-----|
| Multiple translations (12 local + NKJV API) | 1–5 | — |
| Strong's concordance (KJV+S, ASV+S) | early | — |
| Cross-references panel | early | — |
| Commentaries (3 local JSON + 3 live API) | 15 | #38 |
| Dictionaries: Easton's, Smith's, Hitchcock's | 16 | #46 |
| Word search with filters + pagination | early | — |
| Sermon notes (localStorage, multi-session, export TXT/DOCX/PDF) | 6–7 | #15 |
| Session history nav `«»` | 9 | #19 |
| Sepia theme | 9 | #19 |
| Grid chapter/verse picker | 8 | #17 |
| Swipe chapter navigation | 16 | #47 |
| Verse sharing (Web Share API + modal) | 13–14 | #28–35 |
| Verse highlights (colour + underline) + Supabase auth | 16–18 | #48–64 |
| Highlight tags (multi-tag, filter in panel) | 20 | #70–73 |
| My Highlights panel (filter by book, colour, tag) | 19–20 | #68, #70, #73 |
| Google OAuth (PKCE, shows toddsroadcoctt.org) | 17, 20 | #56–57, #72 |

### Pending — Bible Reader

- [ ] **Fausset's Bible Dictionary** — `build-fausset.mjs` ready at repo root; run it, then wire into UI (add to `LOCAL_DICTIONARIES`, `DICT_SOURCE_NAMES`, dropdown HTML)
- [ ] **Multiple named bookmarks** — one position saved currently; add named localStorage bookmarks ("Sunday sermon", "Home study")
- [ ] **Copy shareable link** — `#John.3.16` deep-links work but no copy button; add to selection toolbar
- [ ] **Verse-level notes** — short personal note per verse in localStorage
- [ ] **Reading plans** — 365-day / NT-in-90 / custom; daily progress tracker in localStorage
- [ ] **Print stylesheet** — `@media print` to hide nav/controls and output passage only
- [ ] **Search streaming** — full JSON load on first search stalls on slow devices; chunked `setTimeout` yield

### Pending — Homepage (`index.html`)

- [ ] Hero CTA label: "Service Times" → "Join Us This Sunday"
- [ ] Phone number in nav (desktop) / below hero CTAs (mobile) — **need from client**
- [ ] Real congregation photo for hero — group photo after Sunday service
- [ ] "Your First Visit" section — service length, dress, parking, children's program
- [ ] Hero tagline rewrite — **need founding year from client**
- [ ] Bible reader callout card on homepage
- [ ] Contact / enquiry form — no backend yet; recommend Formspree or EmailJS (zero server required)

### Pending — Translations to Consider

From `seven1m/open-bibles` (all public domain, converter at `SCRIPTS/zefania-to-json.js`):
- **BBE** (Bible in Basic English) — simple vocabulary, good for new readers
- WEB-BE, OEB-US, OEB-CW, DRA (Catholic/Vulgate-based)

---

## Known Issues & Tech Debt

| Priority | Issue | Impact | Effort | Status |
|----------|-------|--------|--------|--------|
| 🔴 HIGH | `STRONGS_DATA` embedded in HTML bloats file | Slow first load on mobile | 3–4 h | Open |
| 🟠 MEDIUM | `getElementById()` called 210+ times; no DOM caching | 20–30% slower interactions | 1–2 h | Open |
| 🟠 MEDIUM | Event listeners never removed on navigation | Memory leak after 20+ navigations on mobile | 2 h | Open |
| 🟠 MEDIUM | Interlinear loads full 30 MB JSON into memory | Can crash low-end phones | 3 h | Open |
| 🟠 MEDIUM | No request cancellation on rapid chapter nav | Stale data can overwrite current view | 1–2 h | Open |
| 🟡 LOW | NKJV word search disabled (bolls.life rate-limits at 429) | Users must switch translation to search | — | Won't fix short-term |
| 🟡 LOW | Accessibility: missing ARIA labels, keyboard nav | Screen reader users underserved | 4 h | Open |
| 🟡 LOW | Google OAuth app in "testing" mode | Must manually add each church member as a test user | 10 min | Publish when ready |

---

## Runbooks

### Deploy Checklist

1. **Bump SW** — use the one-liner from Quick Reference (reads from `origin/master` to avoid conflicts)
2. `git add bible-reader.html service-worker.js [any new .json files]`
3. `git commit -m "feat/fix(bible-reader): ..."`
4. `git push origin <branch>` → open PR (branch protection requires PR on `master`)
5. Merge → deploy triggers automatically (~20 s)
6. Verify: `gh run list --limit 1`
7. Reload the page on device to pick up the new SW (`F5` is enough — SW has `skipWaiting` + `clients.claim`)

`index.html` changes don't need a SW bump.

### Adding a Translation

```powershell
# 1. Download the Zefania XML
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/seven1m/open-bibles/master/<file>.xml" `
  -OutFile "BIBLE TRANSLATIONS/<file>.xml"

# 2. Convert
node SCRIPTS/zefania-to-json.js "BIBLE TRANSLATIONS/<file>.xml" "<key>.json"

# 3. Copy to repo root (reader fetches from there)
Copy-Item "BIBLE TRANSLATIONS/<key>.json" "<key>.json"
```

Then in `bible-reader.html`:
- `TRANSLATIONS` object → add `key: 'Label'`
- `TRANSLATION_ABBR` → add `key: 'ABBR'`
- `LOCAL_TRANSLATIONS` Set → add `'key'`
- Translation dropdown HTML (×2 — main picker and parallel picker)
- Bump SW version

### Supabase Configuration (reference)

- **Dashboard:** supabase.com → COC Website project
- **Auth → URL Configuration → Redirect URLs:** must include `https://toddsroadcoctt.org/bible-reader.html` (required for PKCE OAuth)
- **Auth → Providers → Google:** Client ID + Secret from Google Cloud Console → `coc-website` project → Web client 1
- **RLS:** `highlights` table — users can only read/write their own rows (policy on `user_id = auth.uid()`)

---

## Sessions

Sessions are listed newest-first. Each entry captures what shipped; root-cause detail lives in git commit messages and PR descriptions.

---

### Session 20 — 2026-06-01

**PRs #70–73 · SW v43 → v46**

#### Menu mutual exclusivity (PR #70 · v43)
Opening the Translation dropdown previously didn't close the Study/Settings pill menus. Added `querySelectorAll('.pill-dropdown').forEach(m => m.classList.remove('open'))` to `toggleTranslationDropdown`.

#### Hitchcock dictionary overflow (PR #70 · v43)
`.parallel-dropdown-item` had no `white-space` rule. Added `white-space: nowrap` — container now expands to the longest label instead of wrapping.

#### Highlight tags (PR #70 · v43)
- Picker gets a **Tags section** (between mode toggle and swatches) — type a tag, Enter or comma to add; chips with × to remove; max 10 per verse; hidden in bulk-select mode.
- My Highlights panel gets a **tag filter row** — chips for every unique tag, click to filter, "All tags" to clear. Row hidden when no tags exist. Tags shown as chips on each verse row.
- `HIGHLIGHT_CACHE` entries gain `tags: string[]`. `setHighlight` preserves existing tags when colour/style changes. New `setHighlightTags(book, ch, v, tags)` updates tags only.
- Supabase migration applied: `ALTER TABLE highlights ADD COLUMN IF NOT EXISTS tags TEXT[];`

#### Picker stays open after colour pick (PR #71 · v44)
Swatch click previously called `closeHlPicker()` for every pick including single-verse mode. Now single-verse colour picks keep the picker open (active swatch highlighted, tag chips refreshed). Remove swatch and bulk-select mode still close immediately.

#### Google OAuth — PKCE flow (PR #72 · v45)
`createClient` gains `{ auth: { flowType: 'pkce' } }`. `signInWithGoogle` `redirectTo` changed to `window.location.origin + '/bible-reader.html'`. Google consent screen now reads "toddsroadcoctt.org" instead of the raw Supabase project URL.
*Requires:* Supabase Auth → Redirect URLs includes `https://toddsroadcoctt.org/bible-reader.html`; Google Cloud → Web client 1 → Authorized redirect URIs includes same URL.

#### Highlights panel & tags polish (PR #73 · v46)
- `hlPanelNavigate` no longer calls `closeHighlightsPanel()` — panel stays open when tapping a verse. Also calls `renderHighlightsPanel()` after `renderPassage()` resolves so "Tap to read" rows fill in with real text.
- Tags reordered above swatches in picker (was below — hidden by iPhone home bar on bottom sheet).
- `.hl-tags-section` border changed from `border-top` to `border-bottom`.
- Mobile picker `padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px))` — clears iPhone home indicator.
- Desktop Y cap adjusted to `window.innerHeight - 210`.

---

### Session 19 — 2026-06-01

**PR #68 · SW v42**

#### My Highlights panel
Study menu → 🔖 My Highlights. Right-side panel (desktop, 360px) / draggable bottom sheet (mobile ≤860px, 3 snaps: 180px / 55vh / 85vh). Filter by book + colour. Verse list in Bible order, tap to navigate. Anon nudge for signed-out users.

#### Wavy SVG underline fix (bundled in PR #68)
CSS `text-decoration: wavy` produces a perfectly regular sine wave. Replaced all 15 wavy rules with `SVG background-image` using an irregular cubic-bezier path — flat, hand-drawn appearance. `box-decoration-break: clone` for multi-line verses.

---

### Session 18 — 2026-06-01

**PRs #59–64 · SW v37 → v40**

#### Highlight/underline picker redesign (PRs #59–63)
Replaced the bare 4-swatch row with a full picker panel. Mode toggle (Highlight / Underline). 5 colours. Underline options: style (solid/dotted/wavy) + weight (thin/medium/thick). Mobile bottom sheet with `#hl-backdrop` to prevent pill nav being blocked. Batch apply from selection bar. Picker memory — re-opening on a marked verse pre-selects current state.

45 pre-declared compound underline classes (`ul-blue-wavy-thick`, etc.). `text-decoration-thickness` split to its own property (4-value shorthand not broadly supported).

#### Firefox book select fix (PR #64 · v40)
`onmousedown="this.value=''"` caused Firefox to fire `change` on the programmatic clear, consuming the event. Removed `onmousedown`/`onblur` entirely — `onchange` only. Tradeoff: re-selecting the current book no longer reopens the chapter grid.

---

### Session 17 — 2026-05-31

**PRs #56–57 · SW v35–v36**

#### Sign-in feedback (PR #56)
`#auth-toast` — green pill slides in from top on `SIGNED_IN`, auto-dismisses after 3.5s. Auth modal auto-closes on sign-in event.

#### Auth race condition fix (PR #57)
After Google OAuth redirect, Supabase fires `SIGNED_OUT` for the old anon session *after* `SIGNED_IN` for the real user. The 1-second anon fallback timer was restarting, overwriting the real session. Fixed with `hasRealUser` flag — set true on any real auth, blocks anon fallback; reset to false on explicit sign-out.

---

### Session 16 — 2026-05-31

**PRs #46–54 · SW v26–v34**

- **Hitchcock dictionary** (PR #46) — `hitchcock.json` (~2 600 entries). Study menu Dictionary row refactored to arrow-dropdown pattern matching Commentary/Parallel.
- **Swipe navigation** (PR #47) — left = next chapter, right = previous. Passive touch listeners on `#verses-area`; 60px min horizontal, 1.5× H:V ratio guard.
- **Verse highlights + auth** (PRs #48–54) — Supabase project created. `highlights` table with RLS. Anonymous sessions on first visit. Settings → Account: email/password + Google OAuth + reset password + sign-out. Multiple auth UI fix rounds (transparent modal, invisible borders, race condition).

---

### Session 15 — 2026-05-25

**PRs #35–38 · SW v18–v21**

- **Mobile UI bugs** (PR #35 · v19) — Verse selection bar overflow; book name overflow in header (`BOOK_ABBR` at ≤540px); "Study" label hidden in pill bottom tier.
- **Pill menu bugs** (PR #37 · v20) — Translation dropdown mobile overflow; vestigial dividers; Commentary/Parallel sub-menu mobile override; Settings close button + sorted fonts.
- **Commentary local JSON** (PR #38 · v21) — Adam Clarke/Matthew Henry/JFB no longer fetched from `bible.helloao.org`. Now loaded from local JSON (`/{key}.json`) and cached in-memory in `LOCAL_COMMENTARY_FULL`. First-load sizes: AC 11.8 MB, MH 29.9 MB, JFB 9.0 MB.

---

### Session 14 — 2026-05-25

**PRs #28–33 · SW v18**

Verse sharing via right-click context menu. Web Share API on mobile; X/WhatsApp/Facebook/Copy modal on desktop. Four-round null-value bug hunt — root cause was `ctxShare()` calling `hideVerseCtxMenu()` before using `ctxVerseNum`, which reset it to null. Fix: snapshot `const verseNum = ctxVerseNum` before any function calls.

**Lesson:** Always snapshot shared mutable state into a local `const` before calling any function that might reset it.

---

### Session 13 — 2026-05-25

**PR #24–25 · SW v15**

Nav pill redesign — chapter/verse dropdowns removed; grid picker is sole nav mechanism. Bottom nav stripped to translation name + ⓘ. Chevrons merged into pill. SVG chevrons replacing Unicode glyphs. Scroll-to-top clears two-row pill layout on mobile. Firefox book-select re-selection via `onmousedown`/`onblur` (later replaced in session 18).

---

### Sessions 8–12 — 2026-05-24

**PRs #17–22 · SW v12–v15**

- **Session 12** (PR #22) — Critical load fix: `historyPush`/`syncHistoryBtns` called before defined across `<script>` block boundary. Moved to main block.
- **Session 11** (PR #20) — WEB translation 2 John/3 John fix (USFX vs Zefania format; 1 verse → 13 and 14).
- **Session 10** (PR #19) — Session history nav `«»`, sepia theme, notes colour picker, 9 reading fonts. ⚠️ Introduced the load bug fixed in session 12.
- **Session 9** (PR #17) — Grid chapter/verse picker, notes full-page view, 6 bug fixes including offline error handling.

---

### Sessions 3–7 — 2026-05-13 to 2026-05-17

- Sessions 3–4: Infrastructure (deploy workflow → reusable, branch protection, Secrets)
- Session 6: NKJV search investigated (bolls.life 429 — left as-is); code audit
- Session 7 (PR #15): Notes global formatting toolbar — consolidated from per-entry toolbars; `notesActiveFocusedElement` focus tracking

---

### Sessions 1–2 — 2026-05-13

Foundation: floating pill nav → consolidated controls, multiple translations (local JSON + NKJV API), commentary integration, word search, cross-references, Strong's concordance, dark mode, PWA service worker, responsive layout.

---

## File Map

```
coc-website/
├── index.html                    Landing page
├── bible-reader.html             Bible study app (~8 500 lines — CSS + HTML + JS)
├── service-worker.js             PWA cache — current version: coc-bible-v46
├── manifest.json                 PWA manifest
├── handoff.md                    This file
├── favicon.ico / *.png           Favicons
├── og_banner.jpg                 Open Graph image
├── README.md
│
├── Translation JSONs (deployed, fetched client-side):
│   ├── kjv.json asv.json web.json ylt.json lsv.json lxxe.json rvr09.json darby.json
│   ├── kjvs.json asvs.json          (Strong's embedded)
│   ├── hebrew.json greek-nt.json    (Original languages)
│   ├── adam-clarke.json matthew-henry.json jamieson-fausset-brown.json
│   ├── eastons.json smiths.json hitchcock.json   (fausset.json pending)
│   └── crossrefs.json
│
└── Gitignored source directories:
    ├── BIBLE TRANSLATIONS/        Source XML files
    ├── COMMENTARIES/              Commentary source + scripts
    ├── DICTIONARY/                Dictionary source + scripts
    ├── SCRIPTS/                   zefania-to-json.js, etc.
    ├── BRAND/                     Logo assets
    ├── LIBRARY/                   E-book conversion scripts
    └── ARCHIVES/                  Versioned snapshots of bible-reader.html
```

---

## Recommendations

### 1 — Split handoff into two files
`handoff.md` is now the right length for a reference document. As the changelog grows it will become unwieldy. Consider:
- **`handoff.md`** — Quick Reference, Architecture, Feature Status, Known Issues, Runbooks (stays current)
- **`CHANGELOG.md`** — full session history (append-only, never needs restructuring)

### 2 — Automate the SW bump
The bash one-liner in Quick Reference works but requires manual copy-paste every session. A 10-line shell script (`scripts/bump-sw.sh`) checked into the repo would make it a single command and prevent the "forgot to bump" error that has caused multiple extra PRs.

### 3 — Add the Supabase schema to this file
The `highlights` table schema is now documented above. Keep it updated whenever a migration runs — it saves a round-trip to the Supabase dashboard at the start of any session that touches the DB layer.

### 4 — Publish the Google OAuth app
The app is still in testing mode. Publishing it (Google Cloud → OAuth consent screen → Audience → Publish) takes 5 minutes and removes the need to manually add each church member as a test user. No Google review is required for personal/internal apps using only basic scopes.

### 5 — Session-start checklist in CLAUDE.md
The project `CLAUDE.md` has basic architecture but doesn't point to this file. Adding a one-liner like `"See handoff.md for current feature status, known issues, and runbooks"` would orient a new Claude session immediately without needing the user to paste the handoff.

### 6 — Consider a `changelog:` git trailer
Commit messages currently follow `feat/fix(scope): description`. Adding a short `Changelog: Session N` trailer to squash-merge commits would make `git log --grep="Changelog:"` produce an instant changelog without any other tooling.
