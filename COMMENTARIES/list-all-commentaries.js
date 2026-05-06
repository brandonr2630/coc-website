#!/usr/bin/env node
/**
 * list-all-commentaries.js
 * Fetches the full list of available commentaries from bible.helloao.org
 * and displays them with their IDs, names, and licence info.
 *
 * Usage: node list-all-commentaries.js
 */

'use strict';

const https = require('https');

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

async function main() {
  const BASE = 'https://bible.helloao.org';

  console.log('Fetching commentary list from bible.helloao.org...\n');

  const data = await httpGet(`${BASE}/api/available_commentaries.json`);
  const list = data.commentaries || data;

  console.log(`Found ${list.length} commentaries:\n`);
  console.log('─'.repeat(80));
  console.log(`${'ID'.padEnd(35)} ${'Name'.padEnd(30)} Licence`);
  console.log('─'.repeat(80));

  list.forEach(c => {
    const id      = (c.id || '').padEnd(35);
    const name    = (c.name || '').slice(0, 30).padEnd(30);
    const licence = c.licenseUrl ? c.licenseUrl.replace('https://creativecommons.org/','CC:').replace('licenses/','').replace('/','') : (c.licenseNotes || '');
    console.log(`${id} ${name} ${licence}`);
  });

  console.log('\n─'.repeat(80));
  console.log(`\nFull details:\n`);
  list.forEach(c => {
    console.log(`id:       ${c.id}`);
    console.log(`name:     ${c.name}`);
    console.log(`language: ${c.language || c.languageCode || '?'}`);
    console.log(`licence:  ${c.licenseUrl || c.licenseNotes || 'see website'}`);
    if (c.website) console.log(`website:  ${c.website}`);
    console.log('');
  });
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
