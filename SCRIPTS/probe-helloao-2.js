#!/usr/bin/env node
/**
 * probe-helloao-2.js
 * Checks the full available commentaries list and correct chapter URL format.
 *
 * Usage: node probe-helloao-2.js
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
        const isHtml = data.trimStart().startsWith('<!');
        resolve({ status: res.statusCode, isHtml, data });
      });
    }).on('error', e => reject(e));
  });
}

async function main() {
  const BASE = 'https://bible.helloao.org';

  // 1. Get full commentary list
  console.log('── Full available commentaries ──\n');
  const listRes = await httpGet(`${BASE}/api/available_commentaries.json`);
  if (!listRes.isHtml) {
    const list = JSON.parse(listRes.data);
    const commentaries = list.commentaries || list;
    commentaries.forEach(c => {
      console.log(`  id: ${(c.id||'').padEnd(30)} name: ${c.name||''}`);
    });
  }

  // 2. Check chapter URL formats for matthew-henry
  console.log('\n── Matthew Henry chapter URL formats ──\n');
  const formats = [
    '/api/c/matthew-henry/Genesis/1.json',
    '/api/c/matthew-henry/gen/1.json',
    '/api/c/matthew-henry/GEN/1.json',
    '/api/c/matthew-henry/1/1.json',
    '/api/c/matthew-henry/Genesis/1',
    '/api/c/matthew-henry/chapters/Genesis/1.json',
  ];
  for (const f of formats) {
    const r = await httpGet(BASE + f);
    const icon = r.status === 200 && !r.isHtml ? '✅' : (r.isHtml ? '🌐' : '❌');
    console.log(`${icon} [${r.status}] ${f}`);
    if (r.status === 200 && !r.isHtml) {
      console.log(`   ${r.data.slice(0, 300)}\n`);
    }
  }

  // 3. Check the books.json structure for matthew-henry to get exact book names
  console.log('\n── Matthew Henry books.json structure ──\n');
  const booksRes = await httpGet(`${BASE}/api/c/matthew-henry/books.json`);
  if (!booksRes.isHtml) {
    const parsed = JSON.parse(booksRes.data);
    const books = parsed.books || parsed;
    const list = Array.isArray(books) ? books : Object.values(books);
    console.log('First 5 books:', JSON.stringify(list.slice(0, 5), null, 2));
    if (list[0]) {
      console.log('\nSample book keys:', Object.keys(list[0]).join(', '));
      // Try chapter URL using book's own id/name field
      const b = list[0];
      const bookId = b.id || b.key || b.abbreviation || b.name || 'Genesis';
      const chapUrl = `${BASE}/api/c/matthew-henry/${bookId}/1.json`;
      console.log(`\nTrying chapter URL: ${chapUrl}`);
      const chapRes = await httpGet(chapUrl);
      const chapIcon = chapRes.status === 200 && !chapRes.isHtml ? '✅' : '❌';
      console.log(`${chapIcon} [${chapRes.status}]`);
      if (!chapRes.isHtml && chapRes.status === 200) {
        console.log(chapRes.data.slice(0, 400));
      }
    }
  }

  // 4. Also check adam-clarke and jamieson-fausset-brown books structure
  for (const key of ['adam-clarke', 'jamieson-fausset-brown']) {
    console.log(`\n── ${key} books.json ──\n`);
    const r = await httpGet(`${BASE}/api/c/${key}/books.json`);
    if (!r.isHtml && r.status === 200) {
      const parsed = JSON.parse(r.data);
      const books = parsed.books || parsed;
      const list = Array.isArray(books) ? books : Object.values(books);
      console.log('First book:', JSON.stringify(list[0], null, 2));
      if (list[0]) {
        const bookId = list[0].id || list[0].key || list[0].name;
        const chapUrl = `${BASE}/api/c/${key}/${bookId}/1.json`;
        console.log(`\nChapter URL: ${chapUrl}`);
        const cr = await httpGet(chapUrl);
        const icon = cr.status === 200 && !cr.isHtml ? '✅' : '❌';
        console.log(`${icon} [${cr.status}]`);
        if (!cr.isHtml && cr.status === 200) {
          console.log(cr.data.slice(0, 400));
        }
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
