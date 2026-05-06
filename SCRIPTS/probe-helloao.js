#!/usr/bin/env node
/**
 * probe-helloao.js
 * Probes bible.helloao.org to find working commentary API endpoints.
 * Uses Node's built-in https module — works on any Node version.
 *
 * Usage: node probe-helloao.js
 */

'use strict';

const https = require('https');

function get(url) {
  return new Promise(resolve => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const isHtml = data.trimStart().startsWith('<!');
        resolve({
          status: res.statusCode,
          isHtml,
          preview: isHtml ? '(HTML — not JSON)' : data.slice(0, 220)
        });
      });
    }).on('error', e => {
      resolve({ status: 'ERR', isHtml: false, preview: e.message });
    });
  });
}

async function main() {
  const BASE = 'https://bible.helloao.org';

  const endpoints = [
    '/api/available_commentaries.json',
    '/api/available_commentaries',
    '/api/commentaries.json',
    '/api/commentaries',
    '/api/',
    '/api/c/matthew-henry/books.json',
    '/api/c/matthew-henry/Genesis/1.json',
    '/api/c/matthew-henry/Matthew/1.json',
    '/api/c/matthew-henry-complete/books.json',
    '/api/c/mhc/books.json',
    '/api/c/barnes-notes/books.json',
    '/api/c/barnes/books.json',
    '/api/c/gill/books.json',
    '/api/c/gills-exposition/books.json',
    '/api/c/clarke/books.json',
    '/api/c/adam-clarke/books.json',
    '/api/c/jfb/books.json',
    '/api/c/jamieson-fausset-brown/books.json',
    '/api/c/wesley/books.json',
    '/api/c/john-wesleys-notes/books.json',
  ];

  console.log('Probing bible.helloao.org...\n');

  for (const ep of endpoints) {
    const r = await get(BASE + ep);
    const icon = r.status === 200 && !r.isHtml ? '✅' : (r.isHtml ? '🌐' : '❌');
    console.log(`${icon} [${r.status}] ${ep}`);
    if (r.status === 200 && !r.isHtml) {
      console.log(`   ${r.preview}\n`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
