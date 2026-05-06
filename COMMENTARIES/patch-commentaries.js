#!/usr/bin/env node
/**
 * patch-commentaries.js
 * Finds chapters missing from commentary JSON files and re-fetches just those.
 * Safe to re-run — only touches chapters that have no verses.
 *
 * Usage: node patch-commentaries.js
 * Requires Node 12+.
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const BASE  = 'https://bible.helloao.org';
const DELAY = 300; // ms — slower than initial download to avoid rate limits

const FILES = [
  { id: 'matthew-henry',        file: 'matthew-henry.json' },
  { id: 'adam-clarke',          file: 'adam-clarke.json'   },
  { id: 'jamieson-fausset-brown', file: 'jamieson-fausset-brown.json' },
];

// Canonical book names → must match keys in the JSON files
const BOOK_NAMES = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon',
  'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah',
  'Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians',
  '2 Corinthians','Galatians','Ephesians','Philippians','Colossians',
  '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon',
  'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
];

// Chapter counts per book
const CHAPTER_COUNTS = [
  50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,
  14,3,9,1,4,7,3,3,3,2,14,4,
  28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22
];

// Book ID codes used by helloao (3-letter)
const BOOK_CODES = [
  'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI',
  '1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER',
  'LAM','EZK','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAH','HAB','ZEP',
  'HAG','ZEC','MAL',
  'MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL',
  '1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN',
  '3JN','JUD','REV'
];

// ── HTTP helper ───────────────────────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (data.trimStart().startsWith('<!')) return reject(new Error('Got HTML'));
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractVerseContent(contentArray) {
  const result = {};
  if (!Array.isArray(contentArray)) return result;
  let currentVerse = null;
  const parts = [];
  for (const item of contentArray) {
    if (item.type === 'verse' && item.number) {
      if (currentVerse !== null && parts.length > 0) {
        result[String(currentVerse)] = parts.join(' ').trim();
      }
      currentVerse = item.number;
      parts.length = 0;
      if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c === 'string' && c.trim()) parts.push(c.trim());
          else if (c && typeof c === 'object' && c.content) {
            const inner = Array.isArray(c.content) ? c.content.join(' ') : String(c.content);
            if (inner.trim()) parts.push(inner.trim());
          }
        }
      }
    } else if (Array.isArray(item.content) && currentVerse !== null) {
      for (const c of item.content) {
        if (typeof c === 'string' && c.trim()) parts.push(c.trim());
      }
    }
  }
  if (currentVerse !== null && parts.length > 0) {
    result[String(currentVerse)] = parts.join(' ').trim();
  }
  return result;
}

// ── Find missing chapters ─────────────────────────────────────────────────────
function findMissing(data) {
  const missing = [];
  BOOK_NAMES.forEach((bookName, i) => {
    const bookData     = data[bookName] || {};
    const totalChapters = CHAPTER_COUNTS[i];
    const bookCode     = BOOK_CODES[i];
    for (let ch = 1; ch <= totalChapters; ch++) {
      const entry = bookData[ch] || bookData[String(ch)];
      if (!entry || Object.keys(entry).length === 0) {
        missing.push({ bookName, bookCode, ch });
      }
    }
  });
  return missing;
}

// ── Patch one commentary ──────────────────────────────────────────────────────
async function patchCommentary(spec) {
  const filePath = path.join(__dirname, spec.file);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠ ${spec.file} not found — skipping.`);
    return;
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${spec.id}`);
  console.log('═'.repeat(60));

  const data    = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const missing = findMissing(data);

  if (missing.length === 0) {
    console.log('  ✅ No missing chapters — complete.');
    return;
  }

  console.log(`  Found ${missing.length} missing chapters. Fetching…\n`);

  let succeeded = 0;
  let failed    = 0;

  for (let i = 0; i < missing.length; i++) {
    const { bookName, bookCode, ch } = missing[i];
    const url = `${BASE}/api/c/${spec.id}/${bookCode}/${ch}.json`;
    process.stdout.write(`  [${String(i+1).padStart(3)}/${missing.length}] ${bookName} ${ch}  `);

    let attempts = 0;
    let success  = false;

    while (attempts < 3 && !success) {
      try {
        const response    = await httpGet(url);
        const content     = response.chapter?.content || [];
        const verseMap    = extractVerseContent(content);

        if (Object.keys(verseMap).length > 0) {
          if (!data[bookName]) data[bookName] = {};
          data[bookName][ch] = verseMap;
          process.stdout.write(`✅  ${Object.keys(verseMap).length} verses\n`);
          succeeded++;
          success = true;
        } else {
          process.stdout.write(`⚠ empty response\n`);
          success = true; // don't retry empty — chapter may not exist
        }
      } catch (e) {
        attempts++;
        if (attempts < 3) {
          process.stdout.write(`retry ${attempts}…  `);
          await sleep(DELAY * attempts * 2);
        } else {
          process.stdout.write(`❌ ${e.message.slice(0,40)}\n`);
          failed++;
        }
      }
    }

    // Save progress every 10 chapters
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(filePath, JSON.stringify(data));
      console.log(`  → Saved progress (${i+1}/${missing.length})\n`);
    }

    await sleep(DELAY);
  }

  fs.writeFileSync(filePath, JSON.stringify(data));
  console.log(`\n  Done: ${succeeded} patched, ${failed} failed.`);
  if (failed > 0) console.log('  Re-run to retry failed chapters.');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Commentary Patch Tool');
  console.log('Checks for missing chapters and re-fetches them.\n');

  for (const spec of FILES) {
    await patchCommentary(spec);
    await sleep(1000);
  }

  console.log('\n✅ Done. Re-upload any patched files to your server.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
