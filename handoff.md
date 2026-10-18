# COC Website — Handoff

*Last updated: 2026-10-18 · Session 23 · SW `coc-bible-v57`*

> ⚠️ **Supabase pauses when idle.** `COC Website` was `INACTIVE` (paused) on 2026-10-18 and was restored the same day (status `COMING_UP`). If highlights or sign-in stop working, check project status first (Supabase dashboard → Restore project).

---

## Quick Reference

| Item | Value |
|------|-------|
| Live URL | `https://toddsroadcoctt.org` |
| Bible reader | `https://toddsroadcoctt.org/bible-reader.html` |
| GitHub repo | `brandonr2630/coc-website` |
| Deploy | Push to `master` via PR → GitHub Actions → reusable workflow in `brandonr2630/projects` → **SSH/rsync** to GreenGeeks (changed files only; `handoff.md`, `CLAUDE.md`, `.github/` are never deployed). Deploy dir `/home/terranre/public_html/toddsroadcoctt` |
| Service worker | `service-worker.js` line 7 · **current: `coc-bible-v57`** |
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
| `fausset.json` | Fausset's Bible Dictionary (1888) — 4,026 entries | 6.7 MB |
| `eastons.json` | Easton's Bible Dictionary (1897) | — |
| `smiths.json` | Smith's Bible Dictionary (1863) | — |
| `hitchcock.json` | Hitchcock's Bible Names (1869) | ~2 600 entries |
| `crossrefs.json` | Cross-references, all 66 books | — |
| `plates.json` | Doré plate index for WEB+ (221 plates: id, title, book, ch, v, vEnd, file, w, h) | 39 KB |
| `plates/*.webp` | Gustave Doré plates (1866), WebP, loaded lazily; every plate ≤ 190 KB (49 of them shrunk to 0.86–0.93 of the original 1400 px build so they fit) | 36.8 MB total, avg 171 KB |
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

### Pending — Bible Reader

- [x] ~~**Fausset's Bible Dictionary**~~ — shipped session 22 (#89, gaps closed in #95: `LEPROSY` is now a `(See LEPER.)` cross-reference; `ABRAM`/`ADORATION` dropped as corrupt at source)
- [ ] **Multiple named bookmarks** — one position saved currently; add named localStorage bookmarks ("Sunday sermon", "Home study")
- [x] ~~**Copy shareable link**~~ — not needed: Share (selection bar → Share) already copies text + deep link, and uses the native share sheet on phones
- [ ] **Verse-level notes** — short personal note per verse in localStorage
- [ ] **Reading plans** — 365-day / NT-in-90 / custom; daily progress tracker in localStorage
- [x] ~~**Print stylesheet**~~ — shipped (#97). Applied rules checked in the browser; a real print preview / PDF has not been checked
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

### Session 23 — 2026-10-18 · WEB+ Doré plates

**SW v55 → v56** · branch `feature/web-plus-dore-plates`

**Follow-up (SW v56 → v57, PR #100 — open and not yet merged when this was written):** plate `079` remapped, all plates now under budget, lightbox made accessible, menu label shortened, true-offline test done — see the last bullets. WEB+ itself shipped in PR #99 (live, SW v56).

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
- **Local checkout cleanup (owner).** The main checkout still carries the pre-merge uncommitted Doré edits (`bible-reader.html`, `service-worker.js`) and a loose `plates.json`. Discard them (`git checkout -- bible-reader.html service-worker.js`, delete `plates.json`) before pulling. Untracked `.diagram-design` and `build-hitchcock.mjs` are unrelated leftovers. Delete the local branches `feature/web-plus-dore-plates`, `fix/dore-plate-polish` and `backup/local-master-2026-10-18` once merged/no longer needed.
- **Still open for WEB+.** Screen-reader test of the lightbox; a phone in airplane mode; eyeballing the 49 shrunk plates; a second plate set by another artist (Schnorr von Carolsfeld has full-Bible coverage and a similar woodcut style; Tissot is in colour but strongest in the Gospels) — the reader would need a plate-set setting and a `plates-<artist>.json` per set; licence and per-book coverage should be checked on Commons first.

---


### Session 22 — 2026-10-18

**PRs #86–97 · SW v47 → v55**

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
├── service-worker.js             PWA cache — current version: coc-bible-v57
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
└── plates/                       221 × <id>.webp Doré plates (WEB+ only)
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
