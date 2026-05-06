#!/usr/bin/env node
/**
 * download-commentaries.js
 * Downloads three public domain Bible commentaries from bible.helloao.org
 *
 * Confirmed API structure (from inspection):
 *   GET /api/c/{id}/{BOOK_CODE}/{chapter}.json
 *   Response: {
 *     commentary: { id, name },
 *     book: { id: "MAT", name: "Matthew", commonName: "Matthew", numberOfChapters: 28 },
 *     chapter: {
 *       number: 1,
 *       content: [
 *         { type: "verse", number: 1, content: ["text string", ...] },
 *         { type: "heading", content: ["heading text"] },
 *         ...
 *       ]
 *     },
 *     numberOfVerses: 25
 *   }
 *
 * Output structure — verse-level (all three commentaries):
 *   { "BookName": { "1": { "1": "verse commentary text", "2": "..." }, ... } }
 *
 * Usage: node download-commentaries.js
 * Requires Node 12+. No npm installs needed.
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const BASE  = 'https://bible.helloao.org';
const DELAY = 150; // ms between requests

const COMMENTARIES = [
  { id: 'matthew-henry',        label: "Matthew Henry's Commentary (1706)", outFile: 'matthew-henry.json' },
  { id: 'adam-clarke',          label: "Adam Clarke's Commentary (1810)",   outFile: 'adam-clarke.json'   },
  { id: 'jamieson-fausset-brown', label: 'Jamieson, Fausset & Brown (1871)', outFile: 'jamieson-fausset-brown.json' },
];

// Canonical book names matching bible-reader.html
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

// ── Extract text from chapter content array ───────────────────────────────────
// content is an array of items like:
//   { type: "verse", number: 1, content: ["text", "more text"] }
//   { type: "heading", content: ["heading"] }
// Returns: { verseNum: "text", ... }
function extractVerseContent(contentArray) {
  const result = {};
  if (!Array.isArray(contentArray)) return result;

  let currentVerse = null;
  const parts = [];

  for (const item of contentArray) {
    if (item.type === 'verse' && item.number) {
      // Save previous verse if any
      if (currentVerse !== null && parts.length > 0) {
        result[String(currentVerse)] = parts.join(' ').trim();
      }
      currentVerse = item.number;
      parts.length = 0;
      // Add verse's own content
      if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c === 'string' && c.trim()) parts.push(c.trim());
          else if (c && typeof c === 'object' && c.content) {
            const inner = Array.isArray(c.content) ? c.content.join(' ') : String(c.content);
            if (inner.trim()) parts.push(inner.trim());
          }
        }
      }
    } else if (item.type === 'heading' || item.type === 'note') {
      // Append headings/notes to current verse context
      if (currentVerse !== null && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c === 'string' && c.trim()) parts.push(c.trim());
        }
      }
    } else if (Array.isArray(item.content) && currentVerse !== null) {
      // Any other content type — append to current verse
      for (const c of item.content) {
        if (typeof c === 'string' && c.trim()) parts.push(c.trim());
      }
    }
  }
  // Save last verse
  if (currentVerse !== null && parts.length > 0) {
    result[String(currentVerse)] = parts.join(' ').trim();
  }
  return result;
}

// ── Download one commentary ───────────────────────────────────────────────────
async function downloadCommentary(spec) {
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`  ${spec.label}`);
  console.log('═'.repeat(62));

  const outPath = path.join(__dirname, spec.outFile);

  // Fetch book list
  let books;
  try {
    const data = await httpGet(`${BASE}/api/c/${spec.id}/books.json`);
    books = data.books || (Array.isArray(data) ? data : Object.values(data));
    console.log(`  ${books.length} books found.`);
  } catch (e) {
    console.error(`  ❌ Book list failed: ${e.message}`);
    return { success: false };
  }

  const output     = {};
  let totalEntries = 0;
  let failedChs    = 0;

  for (const book of books) {
    const bookId      = book.id;                         // e.g. "GEN"
    const commonName  = book.commonName || book.name;    // e.g. "Genesis"
    const chapters    = book.numberOfChapters || book.chapters || 0;

    // Map to canonical name
    const canonical = BOOK_NAMES.find(b =>
      b.toLowerCase().replace(/[\s.]/g, '') === commonName.toLowerCase().replace(/[\s.]/g, '')
    ) || commonName;

    output[canonical] = {};

    for (let ch = 1; ch <= chapters; ch++) {
      try {
        const data          = await httpGet(`${BASE}/api/c/${spec.id}/${bookId}/${ch}.json`);
        const contentArray  = data.chapter?.content || [];
        const verseMap      = extractVerseContent(contentArray);

        if (Object.keys(verseMap).length > 0) {
          output[canonical][ch] = verseMap;
          totalEntries += Object.keys(verseMap).length;
        }
        await sleep(DELAY);
      } catch (e) {
        failedChs++;
      }
    }

    if (Object.keys(output[canonical]).length === 0) {
      delete output[canonical];
    } else {
      process.stdout.write(`  ✓ ${canonical}\n`);
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(output));
  const sizeMB    = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  const bookCount = Object.keys(output).length;
  console.log(`\n  ✅ ${bookCount} books · ${totalEntries.toLocaleString()} verse entries · ${sizeMB} MB`);
  if (failedChs) console.log(`  ⚠  ${failedChs} chapters skipped`);
  console.log(`  → ${spec.outFile}`);
  return { success: true, sizeMB };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Bible Commentary Downloader');
  console.log('Source: bible.helloao.org (CC0 — public domain)\n');

  const results = [];
  for (const spec of COMMENTARIES) {
    results.push({ spec, ...(await downloadCommentary(spec)) });
    await sleep(800);
  }

  console.log(`\n${'═'.repeat(62)}`);
  console.log('  SUMMARY');
  console.log('═'.repeat(62));
  for (const r of results) {
    console.log(r.success
      ? `  ✅  ${r.spec.label.padEnd(42)} ${r.sizeMB} MB  →  ${r.spec.outFile}`
      : `  ❌  ${r.spec.label.padEnd(42)} FAILED`);
  }
  console.log('\n  Upload all .json files to the same folder as your translation JSONs.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
