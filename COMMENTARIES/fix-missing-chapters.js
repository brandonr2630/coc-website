#!/usr/bin/env node
/**
 * fix-missing-chapters.js
 * Scans matthew-henry.json and jamieson-fausset-brown.json,
 * reports every missing chapter, then fetches and patches them.
 *
 * Usage: node fix-missing-chapters.js
 * Place in the same folder as your commentary JSON files.
 * Requires Node 12+. No npm installs needed.
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const BASE  = 'https://bible.helloao.org';
const DELAY = 600; // ms between requests — slower for reliability
const MAX_RETRIES = 5; // more attempts per chapter

// ── Book reference data ───────────────────────────────────────────────────────
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

const CHAPTER_COUNTS = [
  50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,
  14,3,9,1,4,7,3,3,3,2,14,4,
  28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22
];

const BOOK_CODES = [
  'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI',
  '1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER',
  'LAM','EZK','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAH','HAB','ZEP',
  'HAG','ZEC','MAL',
  'MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL',
  '1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN',
  '3JN','JUD','REV'
];

const FILES = [
  { id: 'matthew-henry',          file: 'matthew-henry.json' },
  { id: 'jamieson-fausset-brown', file: 'jamieson-fausset-brown.json' },
];

// ── HTTP helper ───────────────────────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
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

// ── Extract verse content from helloao chapter structure ──────────────────────
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

// ── Find missing chapters in a loaded data object ─────────────────────────────
function findMissing(data) {
  const missing = [];
  BOOK_NAMES.forEach((bookName, i) => {
    const bookData      = data[bookName] || {};
    const totalChapters = CHAPTER_COUNTS[i];
    const bookCode      = BOOK_CODES[i];
    for (let ch = 1; ch <= totalChapters; ch++) {
      const entry = bookData[ch] || bookData[String(ch)];
      if (!entry || Object.keys(entry).length === 0) {
        missing.push({ bookName, bookCode, ch });
      }
    }
  });
  return missing;
}

// ── Process one commentary file ───────────────────────────────────────────────
async function processFile(spec) {
  const filePath = path.join(__dirname, spec.file);

  console.log(`\n${'═'.repeat(62)}`);
  console.log(`  ${spec.id}`);
  console.log(`  File: ${spec.file}`);
  console.log('═'.repeat(62));

  if (!fs.existsSync(filePath)) {
    console.log('  ❌ File not found — skipping.\n');
    return;
  }

  const data        = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const totalChaps  = CHAPTER_COUNTS.reduce((a, b) => a + b, 0);
  const missing     = findMissing(data);
  const presentCount = totalChaps - missing.length;

  // ── Report ──
  console.log(`\n  Present : ${presentCount} / ${totalChaps} chapters`);
  console.log(`  Missing : ${missing.length} chapters`);

  if (missing.length === 0) {
    console.log('\n  ✅ Complete — nothing to patch.\n');
    return;
  }

  console.log('\n  Missing chapters:');
  missing.forEach(m => console.log(`    • ${m.bookName} ${m.ch}`));

  // ── Patch ──
  console.log(`\n  Fetching ${missing.length} missing chapters…\n`);

  let succeeded = 0;
  let failed    = 0;
  const stillMissing = [];

  for (let i = 0; i < missing.length; i++) {
    const { bookName, bookCode, ch } = missing[i];
    const url = `${BASE}/api/c/${spec.id}/${bookCode}/${ch}.json`;
    const progress = `[${String(i + 1).padStart(3)}/${missing.length}]`;
    process.stdout.write(`  ${progress} ${bookName} ${ch}  `);

    let attempts = 0;
    let done     = false;

    while (attempts < MAX_RETRIES && !done) {
      try {
        const response = await httpGet(url);
        const content  = response.chapter?.content || [];
        const verseMap = extractVerseContent(content);

        if (Object.keys(verseMap).length > 0) {
          if (!data[bookName]) data[bookName] = {};
          data[bookName][ch] = verseMap;
          process.stdout.write(`✅  ${Object.keys(verseMap).length} verses\n`);
          succeeded++;
        } else {
          process.stdout.write(`⚠  no content returned\n`);
          stillMissing.push(`${bookName} ${ch}`);
        }
        done = true;
      } catch (e) {
        attempts++;
        if (attempts < MAX_RETRIES) {
          const wait = DELAY * Math.pow(2, attempts);
          process.stdout.write(`retry ${attempts} (${wait}ms)…  `);
          await sleep(wait);
        } else {
          process.stdout.write(`❌  ${e.message.slice(0, 40)}\n`);
          failed++;
          stillMissing.push(`${bookName} ${ch}`);
        }
      }
    }

    // Save progress every 10 fetches
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(filePath, JSON.stringify(data));
      console.log(`  → Progress saved (${i + 1}/${missing.length})\n`);
    }

    await sleep(DELAY);
  }

  // Final save
  fs.writeFileSync(filePath, JSON.stringify(data));

  console.log(`\n  ─────────────────────────────────────────`);
  console.log(`  Patched : ${succeeded}`);
  console.log(`  Failed  : ${failed}`);

  if (stillMissing.length > 0) {
    console.log('\n  Still missing (re-run to retry):');
    stillMissing.forEach(m => console.log(`    • ${m}`));
  } else {
    console.log(`\n  ✅ ${spec.file} is now complete.`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Commentary Chapter Finder & Patcher');
  console.log('Source: bible.helloao.org\n');

  for (const spec of FILES) {
    await processFile(spec);
    await sleep(1500);
  }

  console.log('\n\nDone. Re-upload any patched files to your server.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
