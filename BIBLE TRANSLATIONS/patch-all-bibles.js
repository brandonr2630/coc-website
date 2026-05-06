#!/usr/bin/env node
/**
 * patch-all-bibles.js
 * Scans all local Bible translation JSON files, finds empty chapters,
 * and re-fetches them from bolls.life.
 *
 * Usage:
 *   node patch-all-bibles.js
 *
 * Place this script in the same folder as your JSON files, then run it.
 * Requires Node.js 18+.
 *
 * Safe to re-run — only patches chapters that are still empty.
 * LXXE (Septuagint) only covers the OT, so NT gaps are expected and skipped.
 */

const fs   = require('fs');
const path = require('path');

// ── Translation config ────────────────────────────────────────────────────────
// key: filename (without .json) → bolls.life API code
const TRANSLATIONS = {
  web:   'WEB',
  kjv:   'KJV',
  asv:   'ASV',
  ylt:   'YLT',
  rvr09: 'RVR09',
  lsv:   'LSV',
  lxxe:  'LXXE',
  kjvs:  'KJVS',   // KJV + Strong's
  asvs:  'ASVS',   // ASV + Strong's
};

// LXXE is OT-only — NT book numbers (40–66) will always be empty; skip them
const LXXE_MAX_BOOK = 39;

// ── Timing ───────────────────────────────────────────────────────────────────
const DELAY_MS    = 400;   // pause between requests (ms)
const MAX_RETRIES = 3;     // retry attempts per chapter on failure

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

async function fetchChapter(bollsCode, bookNum, chapter, attempt = 1) {
  const url = `https://bolls.life/get-chapter/${bollsCode}/${bookNum}/${chapter}/`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Empty response');
    const chapterObj = {};
    for (const v of data) {
      // Strong's translations return { verse, text, rawHtml } — preserve rawHtml
      // Non-Strong's just store plain text
      if (v.pk !== undefined) {
        // Strong's format from bolls — store as { t: plainText, h: rawHtml }
        chapterObj[v.verse] = { t: stripHtml(v.text), h: v.text };
      } else {
        chapterObj[v.verse] = stripHtml(v.text);
      }
    }
    return chapterObj;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await sleep(DELAY_MS * attempt * 2);
      return fetchChapter(bollsCode, bookNum, chapter, attempt + 1);
    }
    throw err;
  }
}

function findEmptyChapters(data, skipBooksAbove) {
  const missing = [];
  for (const [bookStr, bookData] of Object.entries(data)) {
    const bookNum = parseInt(bookStr);
    if (skipBooksAbove && bookNum > skipBooksAbove) continue;
    for (const [chStr, chData] of Object.entries(bookData)) {
      if (!chData || Object.keys(chData).length === 0) {
        missing.push({ bookNum, chapter: parseInt(chStr) });
      }
    }
  }
  return missing;
}

async function patchTranslation(key, bollsCode, jsonFile) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${key.toUpperCase().padEnd(6)}  →  ${jsonFile}`);
  console.log('═'.repeat(60));

  if (!fs.existsSync(jsonFile)) {
    console.log(`  ⚠️  File not found — skipping.\n`);
    return { key, skipped: true };
  }

  const raw  = fs.readFileSync(jsonFile, 'utf8');
  const data = JSON.parse(raw);

  const skipAbove = key === 'lxxe' ? LXXE_MAX_BOOK : null;
  const missing   = findEmptyChapters(data, skipAbove);

  if (missing.length === 0) {
    console.log(`  ✅ Already complete — no empty chapters found.\n`);
    return { key, succeeded: 0, failed: 0 };
  }

  console.log(`  Found ${missing.length} empty chapters. Fetching…\n`);

  let succeeded = 0;
  let failed    = 0;
  const failures = [];

  for (let i = 0; i < missing.length; i++) {
    const { bookNum, chapter } = missing[i];
    const progress = `  [${String(i + 1).padStart(3)}/${missing.length}]`;
    process.stdout.write(`${progress} Book ${String(bookNum).padStart(2)} Ch ${String(chapter).padStart(3)}  `);

    try {
      const chapterObj = await fetchChapter(bollsCode, bookNum, chapter);
      const verseCount = Object.keys(chapterObj).length;
      data[bookNum][chapter] = chapterObj;
      console.log(`✅  ${verseCount} verses`);
      succeeded++;
    } catch (err) {
      console.log(`❌  FAILED — ${err.message}`);
      failures.push({ bookNum, chapter, error: err.message });
      failed++;
    }

    // Save progress every 20 chapters
    if ((i + 1) % 20 === 0) {
      fs.writeFileSync(jsonFile, JSON.stringify(data));
      console.log(`\n  → Saved progress (${i + 1}/${missing.length})\n`);
    }

    await sleep(DELAY_MS);
  }

  // Final save
  fs.writeFileSync(jsonFile, JSON.stringify(data));

  console.log(`\n  ─────────────────────────`);
  console.log(`  ${key.toUpperCase()}: ${succeeded} patched, ${failed} failed.`);

  if (failures.length) {
    console.log(`\n  Failed chapters:`);
    for (const f of failures) {
      console.log(`    Book ${f.bookNum}, Ch ${f.chapter} — ${f.error}`);
    }
  }

  return { key, succeeded, failed, failures };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Bible JSON Patch Tool');
  console.log('Scanning all local translation files…');

  const results = [];

  for (const [key, bollsCode] of Object.entries(TRANSLATIONS)) {
    const jsonFile = path.join(__dirname, `${key}.json`);
    const result   = await patchTranslation(key, bollsCode, jsonFile);
    results.push(result);
  }

  // ── Summary ──
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  SUMMARY');
  console.log('═'.repeat(60));

  let totalPatched = 0;
  let totalFailed  = 0;

  for (const r of results) {
    if (r.skipped) {
      console.log(`  ${r.key.toUpperCase().padEnd(6)}  ⚠️  file not found`);
    } else {
      const status = r.failed === 0 ? '✅' : '⚠️ ';
      console.log(`  ${r.key.toUpperCase().padEnd(6)}  ${status}  ${r.succeeded} patched, ${r.failed} failed`);
      totalPatched += r.succeeded;
      totalFailed  += r.failed;
    }
  }

  console.log('─'.repeat(60));
  console.log(`  Total: ${totalPatched} chapters patched, ${totalFailed} failed`);

  if (totalFailed > 0) {
    console.log('\n  Re-run this script to retry failed chapters.');
  } else {
    console.log('\n  ✅ All translation files are complete.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
