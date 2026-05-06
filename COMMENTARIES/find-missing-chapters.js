#!/usr/bin/env node
/**
 * find-missing-chapters.js
 * Scans matthew-henry.json and jamieson-fausset-brown.json and reports
 * every chapter that is missing or empty.
 *
 * Usage: node find-missing-chapters.js
 * Place in the same folder as your commentary JSON files.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

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

function checkFile(filename) {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  ❌ File not found: ${filename}\n`);
    return;
  }

  const data    = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const missing = [];
  let   total   = 0;
  let   present = 0;

  BOOK_NAMES.forEach((bookName, i) => {
    const bookData      = data[bookName] || {};
    const totalChapters = CHAPTER_COUNTS[i];

    for (let ch = 1; ch <= totalChapters; ch++) {
      total++;
      const entry = bookData[ch] || bookData[String(ch)];
      if (!entry || Object.keys(entry).length === 0) {
        missing.push(`${bookName} ${ch}`);
      } else {
        present++;
      }
    }
  });

  console.log(`  Present : ${present} / ${total} chapters`);
  console.log(`  Missing : ${missing.length} chapters\n`);

  if (missing.length === 0) {
    console.log('  ✅ Complete — no missing chapters.\n');
  } else {
    missing.forEach(m => console.log(`    • ${m}`));
    console.log('');
  }
}

console.log('Missing Chapter Report\n');

console.log(`${'═'.repeat(50)}`);
console.log("  Matthew Henry's Commentary  (matthew-henry.json)");
console.log(`${'═'.repeat(50)}`);
checkFile('matthew-henry.json');

console.log(`${'═'.repeat(50)}`);
console.log('  Jamieson, Fausset & Brown   (jamieson-fausset-brown.json)');
console.log(`${'═'.repeat(50)}`);
checkFile('jamieson-fausset-brown.json');
