#!/usr/bin/env node
/**
 * download-crossrefs.js
 * Downloads the OpenBible cross-reference dataset and converts to JSON.
 *
 * Usage:   node download-crossrefs.js
 * Output:  ./crossrefs.json
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const OUT_FILE = './crossrefs.json';

// Two sources — script tries each in order until one succeeds
const URLS = [
  'https://raw.githubusercontent.com/scrollmapper/bible_databases/2024/cross_references.txt',
  'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/cross_references.txt',
  'https://openbible.info/data/cross-references.txt',
];

const BOOK_MAP = {
  Gen:'Genesis', Exod:'Exodus', Lev:'Leviticus', Num:'Numbers', Deut:'Deuteronomy',
  Josh:'Joshua', Judg:'Judges', Ruth:'Ruth', '1Sam':'1 Samuel', '2Sam':'2 Samuel',
  '1Kgs':'1 Kings', '2Kgs':'2 Kings', '1Chr':'1 Chronicles', '2Chr':'2 Chronicles',
  Ezra:'Ezra', Neh:'Nehemiah', Esth:'Esther', Job:'Job', Ps:'Psalms',
  Prov:'Proverbs', Eccl:'Ecclesiastes', Song:'Song of Solomon', Isa:'Isaiah',
  Jer:'Jeremiah', Lam:'Lamentations', Ezek:'Ezekiel', Dan:'Daniel', Hos:'Hosea',
  Joel:'Joel', Amos:'Amos', Obad:'Obadiah', Jonah:'Jonah', Mic:'Micah', Nah:'Nahum',
  Hab:'Habakkuk', Zeph:'Zephaniah', Hag:'Haggai', Zech:'Zechariah', Mal:'Malachi',
  Matt:'Matthew', Mark:'Mark', Luke:'Luke', John:'John', Acts:'Acts',
  Rom:'Romans', '1Cor':'1 Corinthians', '2Cor':'2 Corinthians', Gal:'Galatians',
  Eph:'Ephesians', Phil:'Philippians', Col:'Colossians', '1Thess':'1 Thessalonians',
  '2Thess':'2 Thessalonians', '1Tim':'1 Timothy', '2Tim':'2 Timothy', Titus:'Titus',
  Phlm:'Philemon', Heb:'Hebrews', Jas:'James', '1Pet':'1 Peter', '2Pet':'2 Peter',
  '1John':'1 John', '2John':'2 John', '3John':'3 John', Jude:'Jude', Rev:'Revelation',
  // Legacy all-caps abbreviations (openbible.info format)
  GEN:'Genesis', EXO:'Exodus', LEV:'Leviticus', NUM:'Numbers', DEU:'Deuteronomy',
  JOS:'Joshua', JDG:'Judges', RUT:'Ruth', '1SA':'1 Samuel', '2SA':'2 Samuel',
  '1KI':'1 Kings', '2KI':'2 Kings', '1CH':'1 Chronicles', '2CH':'2 Chronicles',
  EZR:'Ezra', NEH:'Nehemiah', EST:'Esther', JOB:'Job', PSA:'Psalms',
  PRO:'Proverbs', ECC:'Ecclesiastes', SNG:'Song of Solomon', ISA:'Isaiah',
  JER:'Jeremiah', LAM:'Lamentations', EZK:'Ezekiel', DAN:'Daniel', HOS:'Hosea',
  JOL:'Joel', AMO:'Amos', OBA:'Obadiah', JON:'Jonah', MIC:'Micah', NAH:'Nahum',
  HAB:'Habakkuk', ZEP:'Zephaniah', HAG:'Haggai', ZEC:'Zechariah', MAL:'Malachi',
  MAT:'Matthew', MRK:'Mark', LUK:'Luke', JHN:'John', ACT:'Acts',
  ROM:'Romans', '1CO':'1 Corinthians', '2CO':'2 Corinthians', GAL:'Galatians',
  EPH:'Ephesians', PHP:'Philippians', COL:'Colossians', '1TH':'1 Thessalonians',
  '2TH':'2 Thessalonians', '1TI':'1 Timothy', '2TI':'2 Timothy', TIT:'Titus',
  PHM:'Philemon', HEB:'Hebrews', JAS:'James', '1PE':'1 Peter', '2PE':'2 Peter',
  '1JN':'1 John', '2JN':'2 John', '3JN':'3 John', JUD:'Jude', REV:'Revelation'
};

function parseRef(raw) {
  if (!raw) return null;
  const parts = raw.trim().split('.');
  if (parts.length < 3) return null;
  const book = BOOK_MAP[parts[0]];
  if (!book) return null;
  return { book, chapter: parseInt(parts[1]), verse: parseInt(parts[2]) };
}

function refKey(b, c, v) { return `${b}|${c}|${v}`; }

function tryDownload(url) {
  return new Promise((resolve, reject) => {
    let data = '';
    const options = { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/plain' } };
    https.get(url, options, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(tryDownload(res.headers.location));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function processData(raw) {
  const lines = raw.split('\n');
  console.log(`Processing ${lines.length.toLocaleString()} lines...`);

  const xrefs = {};
  let skipped = 0;

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.toLowerCase().startsWith('from')) continue;
    const cols = t.includes('\t') ? t.split('\t') : t.split(',');
    if (cols.length < 3) continue;
    const from = parseRef(cols[0]);
    const to   = parseRef(cols[1]);
    const votes = parseInt(cols[2]) || 0;
    if (!from || !to) { skipped++; continue; }
    const key = refKey(from.book, from.chapter, from.verse);
    if (!xrefs[key]) xrefs[key] = [];
    xrefs[key].push([refKey(to.book, to.chapter, to.verse), votes]);
  }

  for (const key of Object.keys(xrefs)) xrefs[key].sort((a, b) => b[1] - a[1]);

  return { xrefs, skipped };
}

async function main() {
  if (fs.existsSync(OUT_FILE)) {
    const size = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
    console.log(`crossrefs.json already exists (${size} KB). Delete it to re-download.`);
    return;
  }

  let raw = null;
  for (const url of URLS) {
    try {
      process.stdout.write(`Trying: ${url} ... `);
      raw = await tryDownload(url);
      console.log('OK');
      break;
    } catch(e) {
      console.log(`Failed (${e.message})`);
    }
  }

  if (!raw) {
    console.error('\n❌ All sources failed. Check your internet connection.');
    process.exit(1);
  }

  const { xrefs, skipped } = processData(raw);
  const verseCount = Object.keys(xrefs).length;
  const totalRefs  = Object.values(xrefs).reduce((s, a) => s + a.length, 0);

  fs.writeFileSync(OUT_FILE, JSON.stringify(xrefs));
  const size = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);

  console.log(`\n✅ Done!`);
  console.log(`   Verses with cross-references: ${verseCount.toLocaleString()}`);
  console.log(`   Total links:  ${totalRefs.toLocaleString()}`);
  console.log(`   Output: ${path.resolve(OUT_FILE)} (${size} KB)`);
  console.log(`\nUpload crossrefs.json alongside bible-reader.html.`);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
