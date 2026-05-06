#!/usr/bin/env node
/**
 * check-commentary-sources.js
 * Tests all possible source URLs for each commentary and reports what works.
 * Run this first to identify the correct paths before running the download script.
 *
 * Usage: node check-commentary-sources.js
 */

'use strict';

const SCROLLMAPPER_BASE = 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/';
const HELLOAO_BASE      = 'https://bible.helloao.org';

// All plausible scrollmapper filename variants for each commentary
const SM_VARIANTS = {
  'matthew-henry': ['json/eng_mhc.json','json/en_mhc.json','json/t_mhc.json','json/mhc.json','json/MHC.json'],
  'barnes':        ['json/eng_barnes.json','json/en_barnes.json','json/t_barnes.json','json/Barnes.json'],
  'gill':          ['json/eng_gill.json','json/en_gill.json','json/t_gill.json','json/Gill.json'],
  'clarke':        ['json/eng_clarke.json','json/en_clarke.json','json/t_clarke.json','json/Clarke.json'],
  'jfb':           ['json/eng_jfb.json','json/en_jfb.json','json/t_jfb.json','json/JFB.json'],
  'wesley':        ['json/eng_wes.json','json/en_wes.json','json/t_wes.json','json/Wesley.json','json/eng_wesley.json'],
};

// Helloao commentary keys to test
const HELLOAO_KEYS = {
  'matthew-henry': ['MHC','MatthewHenry','matthew-henry','mhc'],
  'barnes':        ['Barnes','barnes','Albert-Barnes'],
  'gill':          ['Gill','gill','John-Gill'],
  'clarke':        ['Clarke','clarke','Adam-Clarke'],
  'jfb':           ['JFB','jfb','Jamieson','JamiesonFaussetBrown'],
  'wesley':        ['Wesley','wesley','John-Wesley'],
};

async function testUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.status;
  } catch (e) {
    return `ERR: ${e.message.slice(0, 40)}`;
  }
}

async function testHelloaoKey(key) {
  try {
    const res = await fetch(`${HELLOAO_BASE}/api/c/${key}/books.json`);
    if (!res.ok) return res.status;
    const data = await res.json();
    return Array.isArray(data) ? `✅ ${data.length} books` : '✅ (object)';
  } catch (e) {
    return `ERR: ${e.message.slice(0, 40)}`;
  }
}

async function main() {
  console.log('Commentary Source Diagnostic\n');

  // First check if helloao lists available commentaries
  console.log('── Available commentaries on bible.helloao.org ──');
  try {
    const res = await fetch(`${HELLOAO_BASE}/api/available_commentaries.json`);
    if (res.ok) {
      const data = await res.json();
      console.log('✅ Available commentaries:', JSON.stringify(data, null, 2).slice(0, 500));
    } else {
      console.log(`❌ HTTP ${res.status}`);
    }
  } catch (e) {
    console.log(`❌ ${e.message}`);
  }

  console.log('\n── Scrollmapper GitHub URLs ──');
  for (const [key, variants] of Object.entries(SM_VARIANTS)) {
    console.log(`\n  ${key}:`);
    for (const v of variants) {
      const status = await testUrl(SCROLLMAPPER_BASE + v);
      const icon   = status === 200 ? '✅' : '❌';
      console.log(`    ${icon} ${status}  ${v}`);
    }
  }

  console.log('\n── Helloao Commentary Keys ──');
  for (const [key, candidates] of Object.entries(HELLOAO_KEYS)) {
    console.log(`\n  ${key}:`);
    for (const k of candidates) {
      const result = await testHelloaoKey(k);
      console.log(`    ${k}: ${result}`);
    }
  }

  console.log('\nDone. Share the output above so the download script can be fixed.');
}

main().catch(e => { console.error(e); process.exit(1); });
