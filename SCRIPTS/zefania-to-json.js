// Convert a Zefania XML Bible to the flat JSON format used by the COC Bible reader.
// Usage: node zefania-to-json.js <input.xml> <output.json>

const fs   = require('fs');
const path = require('path');

const [,, src, dst] = process.argv;
if (!src || !dst) {
  console.error('Usage: node zefania-to-json.js <input.xml> <output.json>');
  process.exit(1);
}

const xml   = fs.readFileSync(src, 'utf8');
const bible = {};

const bookRe   = /<BIBLEBOOK\s[^>]*bnumber="(\d+)"[^>]*>([\s\S]*?)<\/BIBLEBOOK>/g;
const chapRe   = /<CHAPTER\s[^>]*cnumber="(\d+)"[^>]*>([\s\S]*?)<\/CHAPTER>/g;
const verseRe  = /<VERS\s[^>]*vnumber="(\d+)"[^>]*>([\s\S]*?)<\/VERS>/g;

let bookMatch;
while ((bookMatch = bookRe.exec(xml)) !== null) {
  const bnum     = bookMatch[1];
  const bookBody = bookMatch[2];
  const chapters = {};

  let chapMatch;
  chapRe.lastIndex = 0;
  while ((chapMatch = chapRe.exec(bookBody)) !== null) {
    const cnum     = chapMatch[1];
    const chapBody = chapMatch[2];
    const verses   = {};

    let vMatch;
    verseRe.lastIndex = 0;
    while ((vMatch = verseRe.exec(chapBody)) !== null) {
      const vnum = vMatch[1];
      const text = vMatch[2]
        .replace(/<[^>]+>/g, '')   // strip any inline tags
        .replace(/&amp;/g,  '&')
        .replace(/&lt;/g,   '<')
        .replace(/&gt;/g,   '>')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .trim();
      if (text) verses[vnum] = text;
    }
    if (Object.keys(verses).length) chapters[cnum] = verses;
  }
  if (Object.keys(chapters).length) bible[bnum] = chapters;
}

fs.writeFileSync(dst, JSON.stringify(bible), 'utf8');
console.log(`Written ${dst} — ${Object.keys(bible).length} books`);
