#!/usr/bin/env node
/**
 * inspect-commentary.js
 * Fetches one chapter from each commentary and shows the full JSON structure.
 * Run this to see exactly what field names the API returns.
 *
 * Usage: node inspect-commentary.js
 */

'use strict';

const https = require('https');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (data.trimStart().startsWith('<!')) return reject(new Error('Got HTML'));
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse: ${e.message}\nRaw: ${data.slice(0,200)}`)); }
      });
    }).on('error', reject);
  });
}

async function inspect(id, bookId) {
  const BASE = 'https://bible.helloao.org';
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${id}  —  book: ${bookId}, chapter: 1`);
  console.log('═'.repeat(60));

  try {
    const data = await httpGet(`${BASE}/api/c/${id}/${bookId}/1.json`);
    // Show top-level keys
    console.log('\nTop-level keys:', Object.keys(data));
    // Show each key's type and preview
    for (const [k, v] of Object.entries(data)) {
      if (k === 'commentary') {
        console.log(`\n  commentary: { id: "${v.id}", name: "${v.name}" }`);
      } else if (typeof v === 'string') {
        console.log(`\n  ${k} (string, ${v.length} chars):`);
        console.log(`    "${v.slice(0, 120)}..."`);
      } else if (Array.isArray(v)) {
        console.log(`\n  ${k} (array, ${v.length} items):`);
        if (v[0]) {
          console.log('    Item[0] keys:', Object.keys(v[0]));
          console.log('    Item[0]:', JSON.stringify(v[0]).slice(0, 200));
        }
      } else if (typeof v === 'object' && v !== null) {
        console.log(`\n  ${k} (object):`, JSON.stringify(v).slice(0, 200));
      } else {
        console.log(`\n  ${k}:`, v);
      }
    }
  } catch (e) {
    console.error('  Error:', e.message);
  }
}

async function main() {
  // Matthew Henry — OT book
  await inspect('matthew-henry', 'GEN');
  // Adam Clarke — OT book
  await inspect('adam-clarke', 'GEN');
  // JFB — OT book
  await inspect('jamieson-fausset-brown', 'GEN');
  // Also check NT for Matthew Henry
  await inspect('matthew-henry', 'MAT');
}

main().catch(e => { console.error(e); process.exit(1); });
