#!/usr/bin/env node
/**
 * list-helloao-commentaries.js
 * Fetches the full list of available commentaries from bible.helloao.org
 * and tests each one to find which public domain commentaries are available.
 *
 * Usage: node list-helloao-commentaries.js
 */

'use strict';

const BASE = 'https://bible.helloao.org';

const PUBLIC_DOMAIN_KEYWORDS = [
  'henry', 'barnes', 'gill', 'clarke', 'jamieson', 'jfb', 'wesley',
  'fausset', 'brown', 'public', 'domain', 'matthew', 'adam', 'john', 'albert'
];

async function main() {
  console.log('Fetching available commentaries from bible.helloao.org...\n');

  let commentaries;
  try {
    const res = await fetch(`${BASE}/api/available_commentaries.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    commentaries = await res.json();
  } catch (e) {
    console.error('Failed to fetch list:', e.message);
    process.exit(1);
  }

  console.log(`Found ${commentaries.length} commentaries total.\n`);
  console.log('── Full list ──');
  commentaries.forEach(c => {
    const name = c.name || c.id || c.key || JSON.stringify(c);
    const id   = c.id   || c.key || c.abbreviation || '';
    console.log(`  ${id.padEnd(25)} ${name}`);
  });

  console.log('\n── Likely public domain matches ──');
  const matches = commentaries.filter(c => {
    const str = JSON.stringify(c).toLowerCase();
    return PUBLIC_DOMAIN_KEYWORDS.some(k => str.includes(k));
  });

  if (matches.length === 0) {
    console.log('  None found matching keywords.');
  } else {
    for (const m of matches) {
      const id = m.id || m.key || m.abbreviation || '';
      console.log(`\n  ${id} — ${m.name || ''}`);
      // Test fetching books for this commentary
      try {
        const res = await fetch(`${BASE}/api/c/${id}/books.json`);
        if (res.ok) {
          const books = await res.json();
          const count = Array.isArray(books) ? books.length : Object.keys(books).length;
          console.log(`    ✅ Books endpoint works — ${count} books`);
          // Sample a verse to see structure
          const firstBook = Array.isArray(books) ? books[0] : Object.values(books)[0];
          if (firstBook) {
            const bookName = firstBook.name || firstBook;
            const chRes = await fetch(`${BASE}/api/c/${id}/${bookName}/1.json`);
            if (chRes.ok) {
              const chData = await chRes.json();
              console.log(`    Sample keys (${bookName} ch.1):`, Object.keys(chData).join(', '));
              // Show first verse/entry
              const verses = chData.verses || chData.comments || chData.content || chData;
              if (Array.isArray(verses) && verses[0]) {
                console.log(`    Sample entry keys:`, Object.keys(verses[0]).join(', '));
              } else if (typeof verses === 'object') {
                console.log(`    Sample entry keys:`, Object.keys(verses).slice(0,8).join(', '));
              }
            }
          }
        } else {
          console.log(`    ❌ Books endpoint HTTP ${res.status}`);
        }
      } catch (e) {
        console.log(`    ❌ ${e.message.slice(0,60)}`);
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
