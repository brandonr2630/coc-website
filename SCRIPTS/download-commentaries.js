#!/usr/bin/env node
/**
 * download-commentaries.js
 * Downloads three public domain Bible commentaries from bible.helloao.org
 *
 * Commentaries:
 *   matthew-henry.json       — Matthew Henry's Commentary (1706)
 *   adam-clarke.json         — Adam Clarke's Commentary (1810)
 *   jamieson-fausset-brown.json — Jamieson, Fausset & Brown (1871)
 *
 * All CC0 public domain. No API key required.
 * Uses Node's built-in https module — works on Node 12+.
 *
 * Usage: node download-commentaries.js
 * Upload output files alongside your translation JSON files on the server.
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const BASE = 'https://bible.helloao.org';
const DELAY = 120; // ms between requests

// ── Commentary definitions ────────────────────────────────────────────────────
const COMMENTARIES = [
  {
    id:      'matthew-henry',
    label:   "Matthew Henry's Commentary (1706)",
    outFile: 'matthew-henry.json',
  },
  {
    id:      'adam-clarke',
    label:   "Adam Clarke's Commentary (1810)",
    outFile: 'adam-clarke.json',
  },
  {
    id:      'jamieson-fausset-brown',
    label:   'Jamieson, Fausset & Brown (1871)',
    outFile: 'jamieson-fausset-brown.json',
  },
];

// ── Canonical book names matching bible-reader.html ───────────────────────────
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
        if (data.trimStart().startsWith('<!')) {
          return reject(new Error('Received HTML instead of JSON'));
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse failed: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Extract text from a chapter response ──────────────────────────────────────
// The API wraps everything in a `commentary` metadata object.
// Content lives in various fields depending on the commentary type.
// This function discovers and extracts whatever text is available.
function extractChapterContent(data, bookId, chapter) {
  // Remove the top-level commentary metadata wrapper
  const payload = { ...data };
  delete payload.commentary;

  // Collect all text content found
  const texts = [];

  // Field names that may contain chapter-level intro/overview text
  const introFields = ['introduction', 'intro', 'overview', 'content', 'text', 'commentary'];

  for (const field of introFields) {
    if (payload[field] && typeof payload[field] === 'string') {
      const t = stripHtml(payload[field]);
      if (t.length > 20) texts.push(t);
    }
  }

  // verses array — each verse may have comment/text
  const versesArray = payload.verses || payload.comments || payload.verseComments || [];
  if (Array.isArray(versesArray) && versesArray.length > 0) {
    // Return structured verse-level object
    const verseMap = {};
    for (const v of versesArray) {
      const vs = String(v.verse || v.verseNumber || v.v || '');
      const raw = v.comment || v.commentary || v.text || v.content || v.notes || '';
      const t = stripHtml(typeof raw === 'string' ? raw : JSON.stringify(raw));
      if (vs && t.length > 5) verseMap[vs] = t;
    }
    if (Object.keys(verseMap).length > 0) {
      return { type: 'verse', data: verseMap };
    }
  }

  // No verse structure — return concatenated intro text as chapter-level
  const combined = texts.join('\n\n').trim();
  if (combined.length > 20) return { type: 'chapter', data: combined };

  return null;
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
    console.error(`  ❌ Could not fetch book list: ${e.message}`);
    return { success: false };
  }

  // Discover content structure from first chapter
  let detectedType = null;
  console.log('  Detecting content structure…');
  try {
    const firstBook = books[0];
    const sample = await httpGet(
      `${BASE}/api/c/${spec.id}/${firstBook.id}/${1}.json`
    );
    const extracted = extractChapterContent(sample, firstBook.id, 1);
    if (extracted) {
      detectedType = extracted.type;
      console.log(`  Content type: ${detectedType}-level`);
    } else {
      console.log(`  ⚠ Could not detect content type. Sample keys: ${Object.keys(sample).join(', ')}`);
      console.log('  Proceeding anyway — will try all field types.');
    }
  } catch (e) {
    console.log(`  ⚠ Structure probe failed: ${e.message}. Proceeding with auto-detection.`);
  }

  const output      = {};
  let   totalBooks  = 0;
  let   totalItems  = 0;
  let   failedChs   = 0;

  for (const book of books) {
    const bookId   = book.id;           // e.g. "GEN"
    const bookName = book.commonName || book.name || bookId;
    const chapters = book.numberOfChapters || book.chapters || 0;

    // Map to canonical name
    const canonical = BOOK_NAMES.find(b =>
      b.toLowerCase().replace(/[\s.]/g, '') === bookName.toLowerCase().replace(/[\s.]/g, '')
    ) || bookName;

    output[canonical] = {};

    for (let ch = 1; ch <= chapters; ch++) {
      try {
        const data      = await httpGet(`${BASE}/api/c/${spec.id}/${bookId}/${ch}.json`);
        const extracted = extractChapterContent(data, bookId, ch);

        if (extracted) {
          if (extracted.type === 'verse') {
            output[canonical][ch] = extracted.data;
            totalItems += Object.keys(extracted.data).length;
          } else {
            output[canonical][ch] = extracted.data;
            totalItems++;
          }
        }
        await sleep(DELAY);
      } catch (e) {
        failedChs++;
      }
    }

    if (Object.keys(output[canonical]).length === 0) {
      delete output[canonical];
    } else {
      totalBooks++;
    }

    process.stdout.write(`  ✓ ${canonical}\n`);
  }

  // Save
  fs.writeFileSync(outPath, JSON.stringify(output));
  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n  ✅ ${totalBooks} books · ${totalItems.toLocaleString()} entries · ${sizeMB} MB`);
  if (failedChs) console.log(`  ⚠  ${failedChs} chapters failed (skipped)`);
  console.log(`  → ${spec.outFile}`);

  return { success: true, sizeMB };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Bible Commentary Downloader');
  console.log('Source: bible.helloao.org (CC0 — public domain)\n');

  const results = [];
  for (const spec of COMMENTARIES) {
    const result = await downloadCommentary(spec);
    results.push({ spec, ...result });
    await sleep(800);
  }

  console.log(`\n${'═'.repeat(62)}`);
  console.log('  SUMMARY');
  console.log('═'.repeat(62));
  for (const r of results) {
    if (r.success) {
      console.log(`  ✅  ${r.spec.label.padEnd(40)} ${r.sizeMB} MB  →  ${r.spec.outFile}`);
    } else {
      console.log(`  ❌  ${r.spec.label.padEnd(40)} FAILED`);
    }
  }
  console.log('\n  Upload these files to the same folder as your translation JSONs.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
