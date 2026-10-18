// Scrapes Fausset's Bible Dictionary (A.R. Fausset, 1888 — public domain) from bible-history.com.
// Output: fausset.json  { KEY: { topic, body } }  — same shape as eastons.json / hitchcock.json.
//
//   node build-fausset.mjs            full run (a few minutes)
//   node build-fausset.mjs --letters=a,z   only some letters (for testing)
//   node build-fausset.mjs --out=sample.json
//
// Phase 1 collects entry URLs from the 26 letter-index pages; phase 2 fetches each
// entry with a small worker pool, retrying transient failures. Keys are the upper-cased
// slug with hyphens kept (ABEL-BETH-MAACHAH), matching the lookup in bible-reader.html.
import { writeFileSync } from 'fs';

const BASE = 'https://bible-history.com';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const LETTERS = (args.letters ? args.letters.split(',') : 'abcdefghijklmnopqrstuvwxyz'.split(''));
const OUT = args.out || 'fausset.json';
const WORKERS = 3;
const DELAY_MS = 200;
const RETRIES = 3;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getText(url) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bible-data-builder/1.0)' } });
      if (res.status === 404) throw Object.assign(new Error(`HTTP 404 — ${url}`), { fatal: true });
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (e.fatal) break;
      await sleep(500 * attempt);
    }
  }
  throw lastErr;
}

function extractEntryLinks(html, letter) {
  const re = new RegExp(`href="(/faussets/${letter}/[^/"]+/)"`, 'gi');
  const links = new Set();
  let m;
  while ((m = re.exec(html)) !== null) links.add(m[1]);
  return [...links];
}

// Some slugs are URL-encoded ("zaanaim%2c+plain+of"): decode to "zaanaim, plain of".
function decodeSlug(slug) {
  try { return decodeURIComponent(slug.replace(/\+/g, ' ')); } catch { return slug.replace(/\+/g, ' '); }
}

const SMALL_WORDS = new Set(['of', 'the', 'or', 'and', 'in', 'to']);

// "abel-beth-maachah" -> "Abel-Beth-Maachah";  "zaanaim, plain of" -> "Zaanaim, Plain of"
function slugToTitle(slug) {
  return decodeSlug(slug)
    .split(' ')
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('-')))
    .join(' ');
}

// "abel-beth-maachah" -> "ABEL-BETH-MAACHAH";  "zaanaim, plain of" -> "ZAANAIM, PLAIN OF"
// (hyphens, commas and spaces kept so keys look like Easton's / Smith's keys)
function slugToKey(slug) {
  return decodeSlug(slug).toUpperCase().replace(/[^A-Z0-9 ,-]/g, '').trim();
}

// Keep the paragraphs before the site's navigation block. No paragraph cap: long entries
// (Jerusalem, Paul) run to dozens of paragraphs.
function extractBody(html) {
  const footerIdx = html.search(/<footer[\s>]/i);
  const content = footerIdx > -1 ? html.slice(0, footerIdx) : html;
  // Entry text ends at the style block / bibliography credit, or at the site nav, whichever comes first.
  const ends = [/<style[\s>]/i, /<b>Bibliography Information/i, /Fausset's Bible Dictionary Home/i]
    .map(re => content.search(re)).filter(i => i > -1);
  const trimmed = ends.length ? content.slice(0, Math.min(...ends)) : content;

  // A few source pages have a malformed opening tag ("<pNumbers 11:5..." with no '>'): repair it.
  const fixed = trimmed.replace(/<p(?=[A-Z(])/g, '<p>');
  const parts = [];
  // Some entries leave <p> unclosed, so a paragraph also ends at the next <p> or the end of the entry.
  const pRe = /<p[^>]*>([\s\S]*?)(?=<\/p>|<p[\s>]|$)/gi;
  let m;
  while ((m = pRe.exec(fixed)) !== null) {
    const text = m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 10) parts.push(`<p>${text}</p>`);
  }
  // Cross-reference stubs ("(See ZINA .)") have no <p>: take the text of the last title-size block.
  if (!parts.length) {
    const k = fixed.lastIndexOf('<font size="+2">');
    const text = k > -1 ? fixed.slice(k).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : '';
    if (text.length > 3) parts.push(`<p>${text}</p>`);
  }
  return parts.join('');
}

// Source pages that are broken beyond repair on bible-history.com. Hand-checked.
//   leprosy: page text is truncated at "<p>&l" (nothing recoverable)
const OVERRIDES = { bakbakkar: '<p>1 Chronicles 9:15.</p>' };

console.log('Phase 1 — collecting entry URLs…');
const allLinks = [];
for (const letter of (args.only ? [] : LETTERS)) {
  try {
    const links = extractEntryLinks(await getText(`${BASE}/faussets/${letter}/`), letter);
    allLinks.push(...links);
    console.log(`  ${letter.toUpperCase()}: ${links.length} entries`);
  } catch (e) {
    console.warn(`  ${letter.toUpperCase()}: SKIPPED — ${e.message}`);
  }
  await sleep(DELAY_MS);
}
if (args.only) for (const p of args.only.split(',')) allLinks.push(`/faussets/${p}/`);
console.log(`Total entries found: ${allLinks.length}`);

console.log('\nPhase 2 — fetching entries…');
const out = args.merge ? JSON.parse((await import('fs')).readFileSync(args.merge, 'utf8')) : {};
const failed = [];
const empty = [];
let next = 0;
let done = 0;

async function worker() {
  while (true) {
    const i = next++;
    if (i >= allLinks.length) return;
    const path = allLinks[i];
    const slug = path.replace(/^\/faussets\/[a-z]\//, '').replace(/\/$/, '');
    try {
      const body = OVERRIDES[slug] || extractBody(await getText(`${BASE}${path}`));
      if (!body) { empty.push(slug); }
      else {
        let key = slugToKey(slug);
        if (out[key]) key = `${key}-${i}`; // never overwrite a different entry that normalises to the same key
        out[key] = { topic: slugToTitle(slug), body };
      }
    } catch (e) {
      failed.push(path);
      console.warn(`  FAILED: ${path} — ${e.message}`);
    }
    if (++done % 250 === 0) console.log(`  ${done}/${allLinks.length}`);
    await sleep(DELAY_MS);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));

writeFileSync(OUT, JSON.stringify(out));
console.log(`\nDone — ${Object.keys(out).length} entries written to ${OUT}`);
console.log(`Failed: ${failed.length}   Empty body (skipped): ${empty.length}`);
if (failed.length) console.log('Failed paths:', failed.join(' '));
if (empty.length) console.log('Empty slugs:', empty.slice(0, 20).join(' '));
