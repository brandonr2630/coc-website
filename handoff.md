# COC Website — Handoff

*Last updated: 2026-10-25 · Sessions 22-24, 26-32 · SW `coc-bible-v66`*

> ⚠️ **Supabase pauses when idle.** `COC Website` was `INACTIVE` (paused) on 2026-10-18 and was restored the same day (status `COMING_UP`). If highlights or sign-in stop working, check project status first (Supabase dashboard → Restore project).

---

## Quick Reference

| Item | Value |
|------|-------|
| Live URL | `https://toddsroadcoctt.org` |
| Bible reader | `https://toddsroadcoctt.org/bible-reader.html` |
| GitHub repo | `brandonr2630/coc-website` |
| Deploy | Push to `master` via PR → GitHub Actions → reusable workflow in `brandonr2630/projects` → **SSH/rsync** to GreenGeeks (changed files only; `handoff.md`, `CLAUDE.md`, `.github/` are never deployed). Deploy dir `/home/terranre/public_html/toddsroadcoctt` |
| Service worker | `service-worker.js` line 7 · **current: `coc-bible-v66`** |
| Supabase project | `COC Website` · ID `bxdenfhpmbsxvaqoxyei` · region `us-east-1` |
| GreenGeeks secrets | `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_PORT`, `CPANEL_USER` (`terranre`). The old Fileman-API secrets (`CPANEL_API_TOKEN`, `CPANEL_HOST`) are no longer used — the WAF blocked that API. |
| Google OAuth | Cloud project `coc-website` · Client `Web client 1` · flow: **PKCE** · **published to production 2026-10-18** (no longer in testing mode) |

> **SW bump rule:** always read the version from `origin/master`, never from the local file.
> ```bash
> git fetch origin master
> current=$(git show origin/master:service-worker.js | grep -oP "coc-bible-v\K\d+")
> sed -i "s/coc-bible-v[0-9]*/coc-bible-v$((current + 1))/" service-worker.js
> ```

---

## Tech Stack

- **Vanilla HTML / CSS / JS** — no build system, no bundler, no npm, no framework
- **Two deployable files:** `index.html` (landing page) · `bible-reader.html` (~8 700 lines, ~0.5 MB — entire app; lexicon data lives in separate JSON files)
- **Service worker** (`service-worker.js`) — PWA offline. **Network-first** (4 s timeout, cache fallback) for navigations, `*.html` and `service-worker.js`; **cache-first** for JSON data and icons; network-only for `bolls.life` and Google Fonts. Only `/bible-reader.html` is required at install, other shell assets are best-effort
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
| `webplus` | WEB+ (World English Bible + Doré plates) | `web.json` via `TRANSLATION_SOURCE` + `plates.json` + `plates/*.webp` | SW (plates cached as viewed) |
| `ylt` | Young's Literal Translation | `ylt.json` | SW + localStorage |
| `lsv` | Literal Standard Version | `lsv.json` | SW + localStorage |
| `lxxe` | English Septuagint (1851) | `lxxe.json` | SW + localStorage |
| `rvr09` | Reina-Valera 1909 | `rvr09.json` | SW + localStorage |
| `darby` | Darby Bible (1890) | `darby.json` | SW + localStorage |
| `kjvs` | KJV + Strong's numbers | `kjvs.json` | SW + localStorage |
| `asvs` | ASV + Strong's numbers | `asvs.json` | SW + localStorage |
| `bsb` | Berean Standard Bible + Strong's numbers (BSB tables, public domain) | `bsb.json` | SW + localStorage |
| `hebrew` | Hebrew OT (Leningrad Codex) | `hebrew.json` | SW + localStorage |
| `greek-nt` | Greek NT | `greek-nt.json` | SW + localStorage |
| `nkjv` | New King James Version | `bolls.life` API | **Never** — copyrighted |

`LOCAL_TRANSLATIONS` = all except `nkjv` · `STRONGS_TRANSLATIONS` = `{kjvs, asvs, bsb}`

### Reference Data

All JSON files live at repo root and are fetched on demand:

| File | Content | Size |
|------|---------|------|
| `adam-clarke.json` | Adam Clarke Commentary | 11.8 MB |
| `matthew-henry.json` | Matthew Henry Commentary | 29.9 MB |
| `jamieson-fausset-brown.json` | JFB Commentary | 9.0 MB |
| `fausset.json` | Fausset's Bible Dictionary (1888) — 4,026 entries | 6.7 MB |
| `eastons.json` | Easton's Bible Dictionary (1897) | — |
| `smiths.json` | Smith's Bible Dictionary (1863) | — |
| `hitchcock.json` | Hitchcock's Bible Names (1869) | ~2 600 entries |
| `crossrefs.json` | Cross-references, all 66 books | — |
| `plates.json` | Doré plate index for WEB+ (221 plates: id, title, book, ch, v, vEnd, file, w, h) | 39 KB |
| `plates/*.webp` | Gustave Doré plates (1866), WebP, loaded lazily; every plate ≤ 190 KB (49 of them shrunk to 0.86–0.93 of the original 1400 px build so they fit) | 36.8 MB total, avg 171 KB |
| `plates-schnorr.json` | Schnorr von Carolsfeld plate index (223 entries; 119 are marked `skip:true` because Doré already illustrates the passage; 104 are shown) | 35 KB |
| `plates/schnorr/*.webp` | *Die Bibel in Bildern* (1860) woodcuts shown as infill: 104 files, mostly lossless full-size bilevel, the rest lossy; all ≤ 190 KB | 8.7 MB total |
| `atlas.js` | Layered offline map module for the Atlas panel (see Session 26) — loaded on first open, network-first in the worker | 33 KB |
| `atlas-places.json` | Atlas places: 1,275 biblical places with best-guess coordinates, confidence, aliases, and a chapter → places index (OpenBible.info Bible Geocoding Data, CC BY 4.0) | 103 KB |
| `atlas-basemap.json` | Atlas basemap: coast, lakes, rivers, Caspian hole for 10°W-80°E / 8-48°N, Spain to India (Natural Earth 10m, public domain) | 550 KB |
| `atlas-relief.webp` · `atlas-relief-levant.webp` | Atlas terrain shading: whole region at 40 px/deg, plus a 240 px/deg Levant/Sinai/Nile patch (Natural Earth shaded relief; AWS Terrain Tiles/SRTM) | 368 KB · 208 KB |
| `strongs-data.json` | Strong's lexicon (H/G) — lazy-loaded by the Strong's tab | 2.7 MB |
| `ubs-data.json` | UBS lexicon senses — lazy-loaded by the UBS tab | 3.6 MB |
| `dodson-data.json` | Dodson NT Greek lexicon — lazy-loaded by the Dodson tab (G numbers only) | 0.6 MB |

`fausset.json` — **done (session 22).** Built by `build-fausset.mjs` (committed at repo root; scrapes bible-history.com, ~12 min, `--letters=`, `--only=g/garlick --merge=fausset.json --out=fausset.json` for patching single entries). Keys follow Easton's/Smith's style (`ABEL-BETH-MAACHAH`, `ZAANAIM, PLAIN OF`). **`LEPROSY` is absent**: its page on bible-history.com is truncated at the source (`<p>&l`); add it by hand to `OVERRIDES` in the script if wanted. `build-hitchcock.mjs` is still untracked locally.

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
- Google app **published to production** (2026-10-18, owner action in Google Auth Platform → Audience). Anyone with a Google account can sign in; no test-user list to maintain. Branding uses `https://toddsroadcoctt.org/privacy.html` and `/terms.html` (see File Map). If the consent screen is ever edited to add sensitive scopes, Google will require verification — the app should keep to `openid`, email and profile.

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
| Fausset's Bible Dictionary (4th dictionary; short tab labels, tab row scrolls instead of overlapping) | 22 | #89, #91 |
| Lexicon data lazy-loaded from JSON; HTML 7.3 MB → 0.5 MB | 22 | #87 |
| Network-first service worker + tolerant pre-cache | 22 | #88, #90 |
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
| Predictive fetching of adjacent chapters (NKJV only) | 30 | #109 |
| Verses top-align across columns (parallel, interlinear) | 31 | #110 |
| Atlas panel: offline basemap + layer framework | 26 | #104-106 |
| Atlas places: pins follow the chapter being read, place search, enlarge button | 29 | — |

### Pending — Bible Reader

- [x] ~~**Fausset's Bible Dictionary**~~ — shipped session 22 (#89, gaps closed in #95: `LEPROSY` is now a `(See LEPER.)` cross-reference; `ABRAM`/`ADORATION` dropped as corrupt at source)
- [ ] **Multiple named bookmarks** — one position saved currently; add named localStorage bookmarks ("Sunday sermon", "Home study")
- [x] ~~**Copy shareable link**~~ — not needed: Share (selection bar → Share) already copies text + deep link, and uses the native share sheet on phones
- [ ] **Verse-level notes** — short personal note per verse in localStorage
- [ ] **Reading plans** — 365-day / NT-in-90 / custom; daily progress tracker in localStorage
- [x] ~~**Print stylesheet**~~ — shipped (#97). Applied rules checked in the browser; a real print preview / PDF has not been checked
- [ ] **Atlas next steps** — verse-level pins (tap a place to see its verses), journeys (`PathLayer`, e.g. Paul's voyages), regions as shapes (`PolygonLayer`, geometry files in the Geocoding data), elevation-tiled relief for sharper zoom (plan in the Session 29 notes), a colour legend, real phone / airplane-mode check
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
| ~~🔴 HIGH~~ | ~~`STRONGS_DATA`/`UBS_DATA`/`DODSON_DATA` embedded in HTML (6.8 MB)~~ | — | — | **Fixed session 22 (PR #87)** — see lazy-load notes |
| 🟠 MEDIUM | `getElementById()` called 210+ times; no DOM caching | 20–30% slower interactions | 1–2 h | Open |
| 🟠 MEDIUM | Event listeners never removed on navigation | Memory leak after 20+ navigations on mobile | 2 h | Open |
| 🟠 MEDIUM | Interlinear loads full 30 MB JSON into memory | Can crash low-end phones | 3 h | Open |
| ~~🟠 MEDIUM~~ | ~~No request cancellation on rapid chapter nav~~ | — | — | **Fixed (#97)** — parallel/commentary/interlinear renderers and the main error path now honour `renderToken` |
| 🟡 LOW | NKJV word search disabled (bolls.life rate-limits at 429) | Users must switch translation to search | — | Won't fix short-term |
| 🟡 LOW | Accessibility: dialog roles, labelled close buttons, `aria-expanded` on dropdowns, Escape handling, keyboard-operable verse numbers, focus ring, reduced motion done (#97). **Still open:** focus trapping/return in dialogs, screen-reader testing, ARIA on search results and highlight rows | Screen-reader users partly served | 2–3 h | Partly fixed |
| ~~🟡 LOW~~ | ~~Google OAuth app in "testing" mode~~ | — | — | **Fixed 2026-10-18** — app published |

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

`index.html` changes don't need a SW bump (pages are network-first). If a file is ever missing live, run the workflow manually (Actions → Deploy to cPanel → Run workflow) for a full redeploy; the push deploy only uploads changed files.

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

### Session 31 — 2026-10-25 · Verses top-align across columns

**SW v64 → v65** · branch `claude/parallel-row-align`

In parallel and interlinear mode, verse N now starts at the same height in both columns. Before, each column flowed on its own and drifted as text lengths differed.

- **How.** Verse blocks in both columns carry `data-align="<verse>"`. `alignRows(area)` measures every block's top (all reads first), then inserts empty `.align-spacer` divs before the blocks that sit higher, so the shorter side gets blank space under its verse. Verses missing from one column are handled the same way. It runs after the columns are in the page (interlinear: after its async column fills), again when `document.fonts.ready` resolves, and on window resize (150 ms debounce).
- **Phone.** At 640 px and under the columns stack, so the spacers are removed and nothing else changes.
- **Commentary mode deliberately not aligned** (owner's call): commentary entries are long and cover verse ranges, so alignment would leave large gaps in the text column. The `data-align` hooks and `alignRows` would work there if that is ever reversed.
- **Expect gaps in interlinear.** Interlinear verses stack words vertically, so every verse is taller than the translation and the left column has blank space under each one.
- **Tested** (local Node server, browser pane): KJV | YLT on John 1, John 3 and Psalm 119 (176 verses), Greek interlinear John 3, Hebrew interlinear Genesis 1: every verse top matched within 0 px. Commentary shows no spacers. At 375 px: no spacers, no horizontal overflow; widening back re-aligned. **Not tested:** a real phone, widths between 641 and 900 px on a real tablet, a screen reader (spacers are `aria-hidden`).

---

### Session 30 — 2026-10-25 · Predictive fetching of adjacent chapters

**SW v63 → v64** · branch `claude/coc-next`

The session-25 "Predictive Fetching" line in earlier notes had no code behind it on any branch (the only unmerged branch, `feature/predictive-fetching`, held an unrelated Greek root-lemma commit, left alone and not merged), so this is a fresh build.

- **Scope: NKJV only.** Local translations keep every chapter in memory once their file is loaded, so next/previous are already instant. Only NKJV fetches one chapter at a time from bolls.life.
- **Behaviour.** After `renderPassage()` draws a chapter, `prefetchAdjacentChapters(token)` (idle callback) fetches the next chapter, then the previous one, crossing book boundaries. It stops if the reader moves on, and is skipped when offline, Save-Data or 2g.
- **Queue.** Reader requests jump ahead of queued prefetches; a prefetch the reader then asks for is promoted (`promoteBollsJob`). A prefetch gets one try and no backoff; any 429 pauses prefetching for 60 s (`bollsPrefetchPausedUntil`).
- **Cache.** `fetchBollsChapter` now has a per-session LRU (`BOLLS_DONE`, 40 chapters) and merges duplicate in-flight requests (`BOLLS_PENDING`). Before this, NKJV refetched on every visit. In-memory only; NKJV is still never written to the service worker or localStorage.
- **Tested** (local Node server, browser pane, bolls.life mocked): John 3 prefetched 4 then 2, moving to 4 made 0 requests; John 21 → Acts 1 boundary; reader request jumped three queued prefetches; 429 paused prefetching; KJV made no bolls calls; no console errors. **Not tested:** the real bolls.life API, a phone, the live site. In the pane `requestIdleCallback` fires late (about 3 s, its timeout); real browsers should fire it almost at once.
- **Greek root-lemma idea (dropped).** Reviewed `0601970` on `feature/predictive-fetching`: only 2 of 5,241 entries in `strongs-lemmas.json` had a family (both listing themselves), the code compared bare numbers (`"942"`) to `"G942"` so it never matched, and stale highlights were not cleared. Not merged. Revisit only with real root-family data.

---

### Session 29 — 2026-10-18 · Atlas places and search

**SW v62 → v63** · branch `feature/atlas-places`

The atlas now shows the places named in the chapter being read, and has a search box.

- **Chapter follows the reader.** `renderPassage()` calls `atlasSync()` on every navigation (all modes). While the panel is open, `PlacesLayer.showChapter('Acts.27')` replaces the pins with that chapter's places and fits the view (capped at 250 px/deg; one place flies to it at 60). While the panel is closed the change is remembered (`atlasDirty`) and applied on open. The panel title reads "Atlas · Acts 27"; a chapter with no places says so ("No places are named in Genesis 1."). `OSIS_BOOKS` in `bible-reader.html` must stay in the canonical order of `BOOKS`.
- **Search.** Box at the top of the map: prefix and substring match on names and alternative spellings (Zion, Mount Zion…), ranked by match quality then by how often the place is mentioned; arrow keys + Enter, Esc or ✕ clears. Choosing a result pins it (even if not in the chapter), flies to it and labels it; the line at the bottom of the map says what it is ("Dalmatia — region (pin at its centre), secure location"). The pin is dropped on the next chapter change. Same-named places show as "Babylon 2" etc. in the list.
- **Pins.** Colour = kind (red city/site, purple region, brown mountain/hill, blue water, grey other); hollow dashed ring = uncertain location (14 places). Tap a pin for the info line, which also says how many other sites scholars propose.
- **Enlarge button** (⤢) in the panel header: wide panel on desktop (overlays the text), nearly full-height sheet on phones. Needed because the map cannot zoom out past its limits, so a narrow panel cannot show places that are far apart (Esther 1: Ethiopia to India).
- **Data.** `atlas-places.json` (103 KB) is built by `SCRIPTS/build-atlas-places.py` from `ancient.jsonl` (cache in `SCRIPTS/atlas-cache/geo/`). For each place it takes the highest-scoring identification (`score.time_total`) and its best resolution; confidence = 2 (≥500) / 1 (≥100) / 0; places with no coordinate (7: unknown, not a place…) and places never named in a translation (60) are dropped; 847 chapters have at least one place. Regions and rivers are a single representative point, not their outline. **Credit:** OpenBible.info (CC BY 4.0) is in the map's corner credit.
- **Bugs fixed on the way.** The fly-to animation could compute a negative progress when rAF timestamps preceded the start time (view zoom collapsed to 0): progress is now clamped to 0..1. `Atlas.load()` now retries twice and no longer caches a failed fetch (one failed basemap download used to leave the land layer empty until reload). Typing in the search box no longer pans/zooms the map (keys) and the dropdown scrolls instead of zooming (wheel).
- **Widen toggle (resolved 2026-10-25, SW v66).** The ⤢ button is now labelled "Wider" / "Narrower" and the choice is remembered in `localStorage` (`coc-atlas-wide`), applied on first open of the panel. Checked in the browser on desktop width (toggle, labels, aria, persistence across reload); not checked on a real phone.
- **Working on the atlas (for the next session).** Assets and `atlas.js` live at the repo root; the data pipeline is `SCRIPTS/build-atlas-*.{mjs,py}` (gitignored, local only, caches in `SCRIPTS/atlas-cache/`, ~250 MB + geo data) and `SCRIPTS/atlas-demo.html` is a sample-data demo of the layer API. Rebuild order: `build-atlas-basemap.mjs` → `build-atlas-relief.py` → `build-atlas-relief-levant.py` (tone-matches to the world relief; its `WORLD` extent must match the printed extent) → `build-atlas-places.py`; copy the outputs to the repo root, update the extents printed by the relief scripts in `atlas.js` (`DEFAULT_RELIEF`), bump the service worker. Test locally with a Node static server, not `python -m http.server` (it drops large files in the Browser pane, which looked like an empty map); the pane stalls `requestAnimationFrame` and `ResizeObserver` while hidden, so call `atlas._render()` / `atlas._resize()` in tests. The host's `max-age` (~15 days) applies to static files: verify deploys with `transferSize` or `cache:'no-store'`. Session worktrees live in `.worktrees/` (excluded in `.git/info/exclude`).
- **Parked idea (not built): sharper relief at high zoom.** Tiled hillshade pyramid `relief/{z}/{x}/{y}.webp` from AWS Terrarium tiles (z9 ≈ 300 m/px, z10 150 m, z11 75 m) with per-zoom shading, 2-3 light directions and a faint elevation tint; ~40 MB for z5-z9 key regions + z10 Holy Land (or ~25 MB lighter). New `ReliefTileLayer` over the existing images; worker caches tiles as viewed.
- **Tested** (local Node static server, real Chrome pane; the Python server dropped large files and made the map look empty): Acts 27, Esther 1 (enlarged: all five places in view), Titus 1, Genesis 1 (empty), John 4, search ("jeru", "dalm", "spa", "rom"), pin cleared on navigation, dark theme, phone width. **Not tested:** a real phone, airplane mode, a screen reader; pins are not keyboard-focusable.

---

### Session 28 — 2026-10-18 · Atlas menu order and stale-cache fix

**SW v61 → v62** · branch `feature/atlas-polish`

- **Menu:** Atlas now sits above Notes in the Study menu.
- **Stale-file bug (found verifying PR #105 live).** The host sends `Cache-Control: max-age=1333600` (~15 days) on static files, so after a deploy the browser's HTTP cache kept serving the old `atlas.js` (`transferSize 0`) and the edge limits from #105 did not show. Fixes: the Atlas loader fetches `/atlas.js` with `cache:'no-cache'` and injects it as an inline script; the worker's network-first and cache-miss fetches use `{cache:'no-cache'}` (revalidate, cheap 304); `Atlas.load()` revalidates its JSON. Lesson for any new asset: do not rely on a plain `<script src>`/`fetch` behind that max-age; and when verifying a deploy, compare `transferSize` or fetch with `cache:'no-store'`. Other static assets (plain `<img>` plates, etc.) still sit behind the host's max-age until the worker cache is rebuilt on a version bump.

---

### Session 27 — 2026-10-18 · Atlas extent widened

**SW v60 → v61** · branch `feature/atlas-extent`

The atlas bounds grew from 8-62°E / 10-46°N to **10°W-80°E / 8-48°N** so places at the edges of the biblical world fit: Spain (Romans 15:24, 28), India (Esther 1:1, 8:9), Dalmatia (2 Timothy 4:10), Cush/Ethiopia and Sheba to the south, the Adriatic and Rome to the west. `BBOX` in `SCRIPTS/build-atlas-basemap.mjs` and `W_/S_/E_/N_` in `SCRIPTS/build-atlas-relief.py` changed, both data files rebuilt, the Levant patch rebuilt for tone matching (`WORLD` in `build-atlas-relief-levant.py`), and `atlas.js` got the new default bounds, relief extent (`x:-10 y:-54.8588 w:90 h:46.8327`) and three more sea names (Arabian, Aegean, Adriatic). **Bug fixed on the way:** the Caspian Sea was drawn as land because inland seas are holes in Natural Earth's land polygons; the basemap now keeps holes over 0.5 sq deg (`holes`) and the land fill, relief clip and coast use `evenodd`. Basemap is now 550 KB (more rivers: Ganges, Indus, Danube, Nile headwaters and West African rivers also show; trim by name in the script if size matters). **Limits:** `_clamp` now keeps the whole viewport inside the map bounds (centre limited to half a screen from each edge) and minimum zoom is 'cover', so panning or zooming out can never show past the data. Checked in the demo: Iberia, Italy, Adriatic, Indus/India, Caspian, and corner/edge cases via setView/zoomAt. Not rechecked on a phone or the live site.

---

### Session 26 — 2026-10-18 · Atlas panel (offline basemap)

**SW v59 → v60** · branch `feature/atlas-panel`

Study → **🗺 Atlas** opens a right-hand panel (bottom sheet ≤860 px) with an offline map of the Bible lands. Basemap only: no place pins yet (decision: places come later from the Geocoding dataset).

- **`atlas.js`** — vanilla module, `window.Atlas`, loaded on first open (`loadAtlasScript()` in `bible-reader.html`). Everything on the map is a `Atlas.Layer`; the Atlas owns pan/zoom/pinch/keys, the layer stack, one shared label placer (highest priority first, tries right/left/above/below, drops what does not fit), selection and a layer-toggle panel. Layers choose `space: 'world'` (scales with the map: coast, relief, rivers, regions, routes) or `'screen'` (constant size: pins, text). Contract: `mount(atlas)`, `update(ctx)`, `labels(ctx)`, `hit(ctx,sx,sy)`, `unmount()`. Built in: `LandLayer`, `ReliefLayer`, `WaterLayer`, `NamesLayer`, `PointLayer`, `PathLayer`, `PolygonLayer` (items inline or lazily from `src`; `setFilter(fn)`). Header comment in the file is the reference; runtime `atlas.addLayer/removeLayer/setVisible/fitBounds/flyTo/theme/layerControl/on('select')`.
- **Data.** `atlas-basemap.json` (300 KB), `atlas-relief.webp` (184 KB), `atlas-relief-levant.webp` (207 KB) are built locally by `SCRIPTS/build-atlas-basemap.mjs`, `build-atlas-relief.py`, `build-atlas-relief-levant.py` from Natural Earth 10m (public domain) and AWS Terrain Tiles z9 (SRTM and others). Source caches live in `SCRIPTS/atlas-cache/` (~250 MB, gitignored). Mercator throughout, so the relief images line up with no reprojection. `SCRIPTS/atlas-demo.html` is a sample-data demo (hand-typed pins, route and regions, not the real dataset).
- **Reader wiring.** Panel + Study row + `openAtlasPanel()/closeAtlasPanel()`; opening My Highlights closes the Atlas and vice versa; Escape closes it; print hides it; the map follows the reader theme (dark → dark, light and sepia → light). Failure to load shows a message in the panel.
- **Service worker.** v60; `/atlas.js` is network-first like the pages, the data files are cached on first use (cache-first), so the atlas works offline after one visit.
- **Credits** (corner of the map): Natural Earth · SRTM/AWS Terrain Tiles. When the places layer ships it must also credit OpenBible.info (CC BY 4.0).
- **Tested** (local server, real Chrome pane): open from Study menu, desktop 1280 px and phone-width bottom sheet, light/dark/sepia theme sync, Escape, exclusivity with My Highlights, 'cover' minimum zoom, select/filter/add/remove layers in the demo. **Not tested:** real phone, screen reader, true offline (airplane mode), the live site. Layer pins are not keyboard-focusable yet (map pans/zooms by arrows and +/-).
- **Known limits.** Relief is blurrier than 240 px/deg outside the Levant patch (40 px/deg). Names layer has six labels only; no ancient region names until the regions layer exists.

---

### Session 24 — 2026-10-18 · Schnorr von Carolsfeld plates fill the gaps in Doré's WEB+ set

**PRs #99-102 · SW v55 → v59** (WEB+ Doré plates #99, Doré polish #100, Schnorr infill #101, Schnorr corrections #102 — all merged and live)

WEB+ now shows **Doré's plates first and Julius Schnorr von Carolsfeld's woodcuts (*Die Bibel in Bildern*, 1860) only where Doré has no plate** — one combined set, no setting to choose. Every plate is captioned with its own artist ("Gustave Doré, 1866" or "Julius Schnorr von Carolsfeld, 1860"). Wikimedia Commons marks every Schnorr file public domain.

- **The rule** (`SCRIPTS/schnorr-infill.mjs`, owner's decision). A Schnorr plate is **skipped** if (1) a Doré plate in the same book and chapter overlaps its verses (94 plates), or (2) it shows the same scene as a Doré plate the verse maths cannot see — the next verses of the same story, or the same scene in a parallel account such as another Gospel or Chronicles (25 plates, listed by hand in `MANUAL` with the Doré plate they duplicate). **119 skipped, 104 shown**, giving **325 plates in total** (Doré 221 + Schnorr 104). The script writes `skip:true` and `dupOf` into `plates-schnorr.json`, deletes the skipped plates' images (they rebuild from `SCRIPTS/schnorr-cache/` if the rule changes), and `build-schnorr-plates.mjs` ignores them. Judgement calls to revisit: neighbouring-verse duplicates such as Boaz meets Ruth (085), David spares Saul (095), Solomon plans the Temple (110) are skipped, while distinct scenes next to a Doré plate (e.g. Shepherds Spread Good News 167, Wise Men 169) are kept.
- **Code.** `loadPlates()` fetches `plates.json` and `plates-schnorr.json` together, drops `skip`/file-less entries, attaches each plate's credit, and merges them per chapter ordered by verse (Doré first on a tie). Either file can be missing: the other still shows, and with neither the verses render without plates. `buildPlateFigure` uses the plate's own credit. (An earlier version of this PR had a Settings selector between the two artists; the owner asked for a combined set, so it was removed along with the `plateSet` key.)
- **Coverage of the infill.** Genesis 21, Exodus 9, Numbers 2, Deuteronomy 2, Joshua 4, Judges 3, 1 Samuel 7, 2 Samuel 7, 1 Kings 4, 2 Kings 3, Ezra/Nehemiah/Esther/Job 1 each, Psalms 4, Isaiah 1, Ezekiel 1, Luke 9, Matthew 5, John 8, Mark 1, Acts 6, Revelation 3. Still nothing for Leviticus or the epistles. Schnorr's Apocrypha plates (Wisdom, Judith, Tobit, Sirach, Maccabees, Susanna — 17) are not in the WEB and were never mapped.
- **Mapping (checked against the book itself — follow-up, SW v58 → v59).** Commons gives only English captions, so the verse map (`SCRIPTS/schnorr-plates-map.mjs`) was written by hand. It was then checked against the **1860 book's own contents list** (German plate titles, from the Internet Archive scan `diebibelinbilder00schn`, OCR text) **and by looking at the plates**. Caution: the book's plate *numbers* do not line up with Commons' file numbers around plates 22-25, so images, not numbers, decided. Corrections: 051 is the Red Sea (not Miriam's Song) → Exodus 14:27-31; 052 is the wilderness feeding → Exodus 16:13-15 (still a guess between manna and water from the rock); 054 → Exodus 31:18; 099 is David made king over Judah → 2 Samuel 2:1-4 (not Samuel anointing David); 100 is Michal despising David → 2 Samuel 6:16-20; 127 is the *building and defence of the city walls* → Nehemiah 4:17-18; 132 shows Job *with his friends* → now a duplicate of Doré's Job and Friends; 176 is the Temptation → duplicate of Doré n09; 185 is two blind men calling out → Matthew 9:27-28; 238 is the seventh seal → Revelation 8:1-2. The four "David the Psalmist" plates (134-137) are themed *Worship / Repentance / Petition / Praise and Thanksgiving*, not specific psalms, so they sit at representative verses (Psalm 95:6-7, 51:17, 86:6-7, 103:1-5). Display titles follow the book (translated) where Commons' caption was wrong or ambiguous. **2 shown plates are still flagged `check`: 052 and 139 (Isaiah — a vision of the Messiah placed at Isaiah 53:3-5; the book's title is just "The Prophet Isaiah").**
- **Image format.** The Schnorr scans are strictly black and white (2 grey levels), so `build-schnorr-plates.mjs` stores them as **lossless WebP at full size** (≈ 60-90 KB, crisper and smaller than lossy); real greyscale/colour scans use the shared lossy ladder. Tooling is local-only like Doré's: `schnorr-plates-map.mjs` (then `schnorr-infill.mjs`), `build-schnorr-plates.mjs` (`--check`, `--only=`), originals in `SCRIPTS/schnorr-cache/`. **After editing the map run the map script, then `schnorr-infill.mjs`, then the build.**
- **Tested** (local server, real Chrome): Genesis 1 (Doré 001 + five Schnorr), Genesis 22 (Doré only — Schnorr's Sacrifice of Isaac is skipped), Matthew 27 (7 Doré + Schnorr Death of Judas), Luke 2 (interleaved in verse order), Exodus 17, John 20, Psalm 51, Leviticus 1 (none); credits per plate in the page and in presentation mode; each source file missing in turn and both missing (verses intact, no errors) and recovery. **Not tested:** phone layout, a screen reader, the live site, and the flagged mappings against the printed book. Not every plate was looked at, only the flagged ones plus spot checks.
- **Cost.** Plate images are now ≈ 46 MB (Doré 36.8 + Schnorr 8.7); the service worker caches a plate only after it is viewed. **Every service-worker version bump deletes the old cache**, so cached `web.json`, plate indexes and plates are re-downloaded the next time the reader is opened online (offline readers lose them until then) — a possible improvement is a separate, versioned-independently data cache.
- **Phone, accessibility and offline checks (follow-up).** *Phone layout* (Chrome at 375 px, touch): Genesis 1, Luke 2, Psalm 51, Matthew 27 with mixed artists — plates 293 px wide, captions wrap, no horizontal overflow, lightbox opens by tap. *Screen reader*: no real screen reader was run, but the browser's **accessibility tree** was read: each plate is `button "Enlarge plate: <title>, <ref>"` followed by its caption text (title, reference, artist), and opening it gives `dialog "<title> · <ref> · <artist>" modal` with a labelled close button holding focus; a real Escape key press closes it and returns focus to the plate. That check found **4 unlabelled buttons (the previous/next chapter arrows, top and bottom) — now labelled** (`aria-label`). *Offline*: with the phone emulation on and the **local server stopped** (an uncached fetch fails), a reload showed Luke 2 with all five plates from both artists, the lightbox worked, and a chapter whose plates were never viewed rendered its verses while the plate figures removed themselves (lazy images drop out when scrolled into view and fail to load) — no JS errors. **Still not done: a real phone in airplane mode and a real screen reader (VoiceOver/TalkBack).** Quick manual check: open WEB+ on a phone, view a chapter with plates online, switch to airplane mode, reload the page and reopen that chapter.

---

### Session 23 — 2026-10-18 · WEB+ Doré plates

**SW v55 → v56** · branch `feature/web-plus-dore-plates`

**Follow-up (SW v56 → v57, PR #100 — merged):** plate `079` remapped, all plates now under budget, lightbox made accessible, menu label shortened, true-offline test done — see the last bullets. WEB+ itself shipped in PR #99 (v56).

New translation key `webplus` (label **WEB+**): World English Bible text (shares `web.json` through `TRANSLATION_SOURCE`, one object in memory) with Gustave Doré's 1866 plates inserted after the last verse of each plate's range. Plates are optional: the reader works if `plates.json` or an image is missing (failed images remove themselves; a failed `plates.json` just means no plates). WEB+ is excluded from Search and from the Parallel list. Every plate is captioned "Title · Ref · Gustave Doré, 1866". No AI-generated or re-rendered art — the images are the Wikimedia Commons scans, resized/re-encoded only.

- **Plate data.** 221 plates (140 OT, 81 NT; the Apocrypha ids 110-113, 125, 133-135, 141-152 are deliberately excluded) mapped in `SCRIPTS/dore-plates-map.mjs` and validated against `web.json`. Build with `npm install sharp --no-save`, then `node SCRIPTS/build-dore-plates.mjs --check | --sample | --style=original`. Originals are cached in `SCRIPTS/dore-cache/` (270 MB, not committed; `SCRIPTS/` is gitignored and lives only in the local checkout). Owner chose the **original** style from the sample sheet (sepia and an approximate watercolor exist in the script).
- **Result.** 221 of 221 matched on Commons. First build: 38.6 MB, 53 plates over the 190 KB target (fixed in v57, see "Budget fix" below; current totals are in the Reference Data table).
- **Flagged mappings reviewed.** All 23 `?` rows were checked against the verse text: 20 confirmed, 2 corrected (`045` → Judges 2:1-4, `067` → Judges 21:12-14). The last one, **`079` David Attacks the Ammonites, is now 2 Samuel 12:26-31** (capture of Rabbah): Commons' own description of the file reads "(2Sam. 12:26-31)" and the engraving shows the king's chariot over the prisoners. 0 rows are flagged now. Tip: the Commons file description of each Doré plate carries its scripture reference — use it to cross-check any mapping.
- **Bug found and fixed on the way (pre-existing on master).** In presentation mode the global arrow-key handler and the presentation handler both ran, so one ArrowRight advanced **two** chapters. The global handler now returns early in presentation mode.
- **Tested** (local server, real Chrome): Genesis 1 (plate after v3), Matthew 27 (7 plates, correct order), Psalm 23 (no plates), Judges 2/21 (corrected plates), lightbox (click and Esc), light/dark/sepia, presentation mode (plate slide, arrows 5→6→5, Esc), 375 px width (no overflow), lazy loading, missing image and missing `plates.json`, and a cached-plate reload with the network emulated offline. **Not verified:** true airplane-mode behaviour (CDP offline emulation does not cover the service worker's own fetches), screen-reader use of the lightbox (it has no dialog role yet), and the live site (not deployed).
- **Cost to know about.** The plate files add 36.8 MB to the repo and to the deployed site; the service worker caches a plate only after it has been viewed.
- **Budget fix (v57).** The 53 plates that stayed over 190 KB had already been scaled to 0.7 and were stuck at the quality floor (q45). The encoder now shrinks in finer steps (`SCALES` in `SCRIPTS/build-dore-plates.mjs`: 1, .85, .7, .65, .6, .55, .5) before it gives up, so they land at q≈50-60 instead: 45 plates at 0.93 of their previous size (e.g. 788×980 → 731×910) and 4 at 0.86 (672×840). Result: **0 plates over budget**, 221 plates, 36.8 MB, largest 190 KB. Rebuilt from the cached originals only.
- **Lightbox accessibility (v57).** `role="dialog"`, `aria-modal`, a label with title · reference · credit, a visible labelled close button that takes focus on open, Tab kept inside the dialog, Esc and close button both return focus to the plate that opened it; plates in the page are keyboard-operable (`tabindex=0`, `role=button`, Enter/Space). Checked by inspecting attributes and focus in Chrome; **not tested with an actual screen reader.**
- **True offline test (v57).** Served from a local server, loaded in Chrome with the service worker controlling the page, viewed Genesis 1 and Matthew 27, then **stopped the server** (an uncached fetch failed with "Failed to fetch", i.e. the network was really gone, including for the worker). Reload still showed the reader in WEB+, the cached plates decoded, the lightbox worked, and a plate that had never been viewed was inserted, failed to load and removed itself with the verses intact and no JS errors. Not tested on a phone in airplane mode.
- **Menu label.** The translation menu item now reads **World English Bible +** (was "WEB+ · World English Bible + Doré Plates"); the pill and share text still say WEB+.
- **Where the plate tooling lives.** `SCRIPTS/` is gitignored, so it exists only in the local checkout (`C:\Users\brand\OneDrive\Documents\Projects\coc-website\SCRIPTS`) with **no backup**: `build-dore-plates.mjs` (encoder with the finer shrink ladder), `dore-plates-map.mjs` (corrected map), `dore-cache/` (~395 MB of originals, so rebuilds need no downloads), `dore-plates-handoff.md` (older instructions — superseded by this entry). Rebuild after a map change: `node SCRIPTS/dore-plates-map.mjs` regenerates `plates.json` **without** `file/w/h`; carry those over from the previous `plates.json` by id (or rerun `build-dore-plates.mjs --style=original`) and minify the JSON.
- **Local checkout and housekeeping (done 2026-10-18).** The main checkout was synced to `origin/master` and all merged local branches deleted (their names and commit hashes are in `C:\Users\brand\OneDrive\Documents\Projects\coc-website-backups\deleted-local-branches-2026-10-18.txt`; restore with `git branch <name> <sha>`). Untracked `.diagram-design` and `build-hitchcock.mjs` are unrelated leftovers. Scripts backup: `coc-website-backups\coc-website-SCRIPTS-final-2026-10-18.zip` (everything in `SCRIPTS/` except the image caches `dore-cache/`, `schnorr-cache/`, which rebuild from Commons).
- **Still open for WEB+.** (1) A real screen-reader test (VoiceOver/TalkBack) and a real phone in airplane mode — only the accessibility tree and a stopped-server emulation were used. (2) The two Schnorr plates still flagged `check`: 052 (manna or water from the rock) and 139 (Isaiah vision). (3) Eyeballing the 49 shrunk Doré plates. (4) **Service-worker version bumps delete the old cache**, so cached `web.json`, plate indexes and plates are re-downloaded online after every deploy; a separate data cache would keep offline readers' content. (5) **Orphaned files on the server**: the deploy only uploads changed files and never deletes, so `plates/schnorr/051.webp`, `132.webp` and `176.webp` (dropped in #102) remain on GreenGeeks, unused (~0.2 MB) — remove via cPanel if you care. (6) A third artist set (Tissot, from the Brooklyn Museum / Jewish Museum) was suggested, not started: it would need a `plates-<artist>.json`, a map and build script like Schnorr's, and entries in `PLATE_SOURCES` and `SCRIPTS/schnorr-infill.mjs`-style duplicate rules.

---


### Session 22 — 2026-10-18

**PRs #86–97 · SW v47 → v55** (WEB+ plate work is in sessions 23-24 above)

Audit of this file against the repo, `origin/master`, Actions and Supabase:

- **Deploy docs corrected.** The shared workflow was migrated from the Fileman API to SSH/rsync (`brandonr2630/projects`, commit `d94408e`, 2026-07-03). Secrets and Quick Reference updated. Last `coc-website` deploy (PR #85, 2026-09-02) succeeded in 18 s.
- **PR #85** (2026-09-02) added an "AI Feature Ideas" section to `README.md` (reference ideas only, nothing built).
- **Supabase project was paused** (`INACTIVE`); restored 2026-10-18 via MCP. Expect it to pause again after idle periods.
- **Fausset's Dictionary shipped (PR #89 · v50).** 4,026 of 4,027 entries; `LEPROSY` missing because its source page is truncated. Scraper rewritten (worker pool, retries, no paragraph cap — Psalms is 36 paragraphs, decodes `%2c`-style slugs, repairs unclosed/malformed `<p>`, keeps `(See X.)` cross-reference stubs). Verified live: menu item, prefix search, long and comma-key entries, Strong's-panel Dict. tab, `fausset.json` cached by the worker.
- **Network-first service worker (PR #90 · v51).** Before this, `bible-reader.html` was cache-first, so a deploy needed two page loads to appear. Verified live by planting a stale page in the cache: a reload still showed the real page and refreshed the cache. Trade-off: online loads always ask the network first (4 s cap).
- **Dictionary tab row fix (PR #91 · v52).** Four dictionaries overflowed the tab row (`min-width:0` + `nowrap` made labels overlap). Tabs now size to content with short labels (`DICT_TAB_LABELS`; full names stay as tooltips); at 320 px the row scrolls instead of overlapping. Verified live at 1280 and 375 px.
- **Deploy docs fixed.** `CLAUDE.md` and `README.md` now describe SSH/rsync deploys and point to this file (previously Fileman API / a non-existent `HANDOVER.md`).
- **Privacy policy and terms pages (PR #93).** Public `privacy.html` and `terms.html`, linked from the home page footer, written to satisfy Google's branding requirements. Contact on both: `coc.toddsroad@gmail.com`. Plain-language drafts — a church leader should read them. Not yet linked from inside `bible-reader.html` (would need an SW bump).
- **Google OAuth app published** (owner, 2026-10-18).
- **Search Console domain verification completed** by the owner, and Google sign-in confirmed working after publishing.
- **Fausset gaps and legal links (PR #95 · v53).** `LEPROSY` added as `(See LEPER.)` (the source page duplicated LEPER and was broken); `ABRAM` and `ADORATION` removed (source body was the word "front"). 25 entries end mid-list with `;` because the source text is truncated — not recoverable from this source. Privacy/Terms links added under Settings → Account and beneath the sign-in modal.
- **Escaping, storage, supply chain (PR #96 · v54).** Tag remove/filter buttons use `data-tag` instead of inline-JS string splicing; `lsGet/lsSet/lsRemove` wrap all `localStorage` use (except the head theme script and Supabase's own session storage); `supabase-js` pinned to `2.118.0` with an SRI hash (byte-identical to what `@2` served). To upgrade: pick a new exact version, recompute `openssl dgst -sha384 -binary supabase.js | openssl base64 -A`, update `integrity`.
- **Stale responses, accessibility, print (PR #97 · v55).** See Known Issues for what remains. Verified on the live site on first load after deploy (network-first service worker): 8 dropdown triggers report `aria-expanded`, Escape closes sign-in/dictionary/dropdowns, print rules present.
- **Lexicon data lazy-loaded (PR #87 · v48).** `STRONGS_DATA`, `UBS_DATA`, `DODSON_DATA` (6.8 MB, three lines at the bottom of `bible-reader.html`) moved to `strongs-data.json`, `ubs-data.json`, `dodson-data.json`. `bible-reader.html` dropped from 7.3 MB to ~0.5 MB. `loadLexicon(key)` fetches a file once; `ensureLexiconTab(tab, clean)` fills a tab only when it is shown (Dodson on an H number needs no fetch). A failed fetch shows an error in the tab and retries on the next tab switch. Data verified identical to the original objects. **Behaviour change:** Strong's/UBS/Dodson are no longer available offline until each has been used once online (the service worker caches them on first fetch).
- **Live `manifest.json` was missing (404) → service worker never installed.** `cache.addAll(SHELL)` is all-or-nothing, so one 404 blocked install; the offline/PWA feature was not working on the live site. The rsync deploy only uploads files changed per push, so the file never came back on its own. Fixed with a manual full redeploy (Actions → Deploy to cPanel → Run workflow, 2026-10-18). **Runbook note:** if a file is missing live, re-run the workflow manually for a full deploy.
- **Service worker hardened (PR #88 · v49).** Only `/bible-reader.html` is required at install (`REQUIRED`); the other shell assets are cached individually with `Promise.allSettled`, so one missing asset can no longer block the worker.
- **Verified on the live site (Chrome):** worker activates and controls the page; `coc-bible-v49` holds the shell plus `strongs-data.json`, `ubs-data.json`, `dodson-data.json` and `kjvs.json` after use; with the network emulated offline the reader reloads and Strong's, UBS and Dodson render from cache. Caveat: CDP offline emulation did not cover the worker's own fetches, so this proves cache-first serving, not true airplane-mode behaviour — worth one real phone check.
- **Full-deploy check:** every tracked deployable file at the repo root returns 200 live (`handoff.md` and `CLAUDE.md` are intentionally excluded from deploy). The repo tracks no subfolder files.
- **After pulling `master` locally:** delete the stale untracked `fausset.json` stub in your checkout first, or `git pull` will refuse to overwrite it.

---

### Session 21 — 2026-06-07

**PRs #81–82, projects repo PR #3 · SW unchanged (v47)**

#### Book nav — same-book chapter grid fix (PRs #81 → #82)

Root cause traced back to session 18 (PR #64): the `onmousedown`/`onblur` book-select hack was removed and noted as a tradeoff — *"re-selecting the current book no longer reopens the chapter grid."* Now fixed properly.

**PR #81** (intermediate): added `onclick="openChapterGrid()"` to the native `<select>`. Merged, then immediately superseded — caused the chapter grid to open behind the book dropdown before any book was selected.

**PR #82** (final): replaced the native `<select id="sel-book">` with a custom `<button id="btn-book">` + `.pill-dropdown` panel (`#book-dropdown-list`). Clicking the button opens the book list; clicking any book item (same or different) calls `selectBookFromDropdown(name)` which closes the panel then opens the chapter grid. No native `change` event ambiguity. Follows the existing `.pill-dropdown` toggle pattern (closes on outside click via global document listener).

**Functions changed:**
- `populateBookSelect()` — now populates `#book-dropdown-list` with `.book-dropdown-item` buttons and updates `#book-label`
- `syncDropdowns()` — calls `populateBookSelect()` instead of setting `sel-book.value`
- `onBookChange()` — removed (replaced by `selectBookFromDropdown`)
- Added: `toggleBookDropdown(e)`, `selectBookFromDropdown(name)`

No SW bump — no cached assets changed.

#### Deploy workflow — HTTP 415 fix (brandonr2630/projects PR #3)

The PR #81 deploy failed with `HTTP 415 Unsupported Media Type` from OpenResty when uploading `bible-reader.html`. Root cause: the reusable workflow used `save_file_content` for text files, which POSTs the file as a URL-encoded body — rejected once the file grew large enough to trip the WAF's payload-size limit.

Fix: removed the binary/text upload split in `brandonr2630/projects/.github/workflows/deploy.yml`. All files now upload via `upload_files` (multipart/form-data) with `overwrite=1`, which has no payload-size restriction and works for both text and binary. The failed run was re-run after the fix and deployed successfully. Change applies to all repos that use the shared workflow.

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
`onmousedown="this.value=''"` caused Firefox to fire `change` on the programmatic clear, consuming the event. Removed `onmousedown`/`onblur` entirely — `onchange` only. Tradeoff: re-selecting the current book no longer reopens the chapter grid. *(Tradeoff resolved in session 21 — PR #82.)*

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
├── privacy.html / terms.html      Public policy pages (required by Google OAuth branding; footer-linked from index.html)
├── bible-reader.html             Bible study app (~8 700 lines, ~0.5 MB — CSS + HTML + JS)
├── service-worker.js             PWA cache — current version: coc-bible-v66
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
│   ├── eastons.json smiths.json hitchcock.json fausset.json
│   ├── crossrefs.json
│   └── strongs-data.json ubs-data.json dodson-data.json   (lazy-loaded lexicons)
├── plates.json                   WEB+ plate index
├── plates-schnorr.json           WEB+ plate index, Schnorr set
└── plates/                       Doré: plates/<id>.webp (221) · Schnorr infill: plates/schnorr/<id>.webp (104) — WEB+ only
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

### 3 — Add the Supabase schema to this file *(done — see Highlights & Auth)*
The `highlights` table schema is now documented above. Keep it updated whenever a migration runs — it saves a round-trip to the Supabase dashboard at the start of any session that touches the DB layer.

### 4 — Publish the Google OAuth app *(done 2026-10-18)*
Published by the owner on 2026-10-18 after adding privacy-policy and terms-of-service pages (PR #93) to the consent-screen branding. Nothing further needed unless scopes change.

### 5 — Session-start checklist in CLAUDE.md *(done — CLAUDE.md now points here)*
The project `CLAUDE.md` has basic architecture but doesn't point to this file. Adding a one-liner like `"See handoff.md for current feature status, known issues, and runbooks"` would orient a new Claude session immediately without needing the user to paste the handoff.

### 6 — Consider a `changelog:` git trailer
Commit messages currently follow `feat/fix(scope): description`. Adding a short `Changelog: Session N` trailer to squash-merge commits would make `git log --grep="Changelog:"` produce an instant changelog without any other tooling.

---

## Session 32 — Berean Standard Bible + Strong's (`bsb`)

- `bsb.json` (13.4 MB) is built by `SCRIPTS/build-bsb.mjs` from the official `bsb_tables.tsv` (bereanbible.com, public domain since 2023-04-30; saved locally as `BIBLE TRANSLATIONS/bsb_tables.tsv`). Same `{t, h}` shape as `kjvs.json`, bare Strong's numbers, tag on the last word of each aligned phrase.
- **Do not use `open-bibles-temp/eng-bsb.usfx.xml`** (eBible's old *Berean Study Bible* export): its Strong's tags are misaligned (Gen 1:1 "God" tagged H8064).
- Table markers dropped by the builder: `-` (untranslated source word), `vvv`, `. . .`. Footnotes and section headings are not carried over. 31,102 verses; matches KJV versification except Esther 10:4–13 (KJV has extra verses).
- Manuscripts: OT `masoretic`, NT new `na28` entry (Greek interlinear uses the `NA28` edition code).
- SW bumped to `coc-bible-v67`.
