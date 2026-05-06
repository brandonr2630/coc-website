#!/usr/bin/env node
/**
 * download-hebrew.js
 * Builds hebrew.json from:
 *   - morphhb  (OSHB XML — CC-BY 4.0, Open Scriptures)
 *   - @metaxia/scriptures-source-stepbible-lexicon (STEPBible Hebrew lexicon — CC-BY 4.0)
 *   - strongs  (fallback glosses)
 *
 * Output: ./hebrew.json
 *   { bookNum: { chapter: { verse: [ {w, t, g, s, m} ] } } }
 *   w = Hebrew word text
 *   t = transliteration
 *   g = English gloss
 *   s = Strong's number (e.g. "H7225")
 *   m = morphology in plain English
 *
 * Usage:  node download-hebrew.js
 * Requires: npm install morphhb strongs @metaxia/scriptures-source-stepbible-lexicon
 */

'use strict';
const fs   = require('fs');
const path = require('path');

// ── Data sources ──────────────────────────────────────────────────────────────
const OSHB_DIR  = path.join(__dirname, 'node_modules/morphhb/wlc');
const LEXICON_H = path.join(__dirname, 'node_modules/@metaxia/scriptures-source-stepbible-lexicon/data/stepbible-tbesh.json');
const OUT_FILE  = path.join(__dirname, 'hebrew.json');

// ── Book map: filename → canonical book number (1-based, Protestant OT order) ─
const BOOK_MAP = {
  'Gen.xml':1,'Exod.xml':2,'Lev.xml':3,'Num.xml':4,'Deut.xml':5,
  'Josh.xml':6,'Judg.xml':7,'Ruth.xml':8,'1Sam.xml':9,'2Sam.xml':10,
  '1Kgs.xml':11,'2Kgs.xml':12,'1Chr.xml':13,'2Chr.xml':14,'Ezra.xml':15,
  'Neh.xml':16,'Esth.xml':17,'Job.xml':18,'Ps.xml':19,'Prov.xml':20,
  'Eccl.xml':21,'Song.xml':22,'Isa.xml':23,'Jer.xml':24,'Lam.xml':25,
  'Ezek.xml':26,'Dan.xml':27,'Hos.xml':28,'Joel.xml':29,'Amos.xml':30,
  'Obad.xml':31,'Jonah.xml':32,'Mic.xml':33,'Nah.xml':34,'Hab.xml':35,
  'Zeph.xml':36,'Hag.xml':37,'Zech.xml':38,'Mal.xml':39
};

// ── Load lexicons ─────────────────────────────────────────────────────────────
console.log('Loading lexicons…');
const lexH   = JSON.parse(fs.readFileSync(LEXICON_H, 'utf8'));
const strongs = require('./node_modules/strongs');

function getGloss(strongsNum) {
  if (!strongsNum) return '';
  // STEPBible lexicon uses zero-padded keys like H7225 (no padding needed, but check both)
  const padded   = strongsNum.replace(/^H(\d+)/, (_, n) => 'H' + n.padStart(4, '0'));
  const unpadded = strongsNum;
  const entry    = lexH[padded] || lexH[unpadded];
  if (entry && entry.gloss) return entry.gloss.split(':')[0].trim(); // take first part
  // Fallback to strongs package
  const fb = strongs[strongsNum] || strongs[padded];
  if (fb && fb.kjv_def) return fb.kjv_def.split(',')[0].trim();
  return '';
}

function getTranslit(strongsNum) {
  if (!strongsNum) return '';
  const padded = strongsNum.replace(/^H(\d+)/, (_, n) => 'H' + n.padStart(4, '0'));
  const entry  = lexH[padded] || lexH[strongsNum];
  return entry ? (entry.transliteration || '') : '';
}

// ── Extract primary Strong's number from OSHB lemma attribute ─────────────────
// Lemma format examples: "7225", "1254 a", "b/7225", "d/8064", "c/853 a"
// Numbers may be bare (Hebrew) or have letter suffixes (variant forms)
function parseStrongs(lemma) {
  if (!lemma) return null;
  // Split compound lemmas by space (multiple roots) — take first root
  const parts = lemma.trim().split(' ');
  for (const part of parts) {
    // Each part may have prefix codes separated by /
    const segments = part.split('/');
    for (const seg of segments) {
      const match = seg.match(/^(\d+)/);
      if (match) return 'H' + match[1];
    }
  }
  return null;
}

// ── Hebrew morphology decoder ─────────────────────────────────────────────────
const VERB_STEMS = {
  q:'Qal', N:'Niphal', p:'Piel', P:'Pual', h:'Hiphil', H:'Hophal',
  t:'Hithpael', o:'Polel', O:'Polal', r:'Hithpolel', m:'Poel', M:'Poal',
  k:'Palel', K:'Pulal', Q:'Qal-Passive', l:'Pilel', L:'Pilal', f:'Pealal',
  D:'Piel-Denom', j:'Hiphil-Denom', i:'Hithpalpel', u:'Nithpael',
  c:'Peal', e:'Peil', E:'Peil', w:'Haphel', v:'Shaphel', s:'Shaphel',
  g:'Etpeal', G:'Etpaal', F:'Ethaph', Z:'Ettaphal'
};
const VERB_CONJ = {
  p:'Perfect', i:'Imperfect', w:'Wayyiqtol', q:'Sequential Imperfect',
  c:'Sequential Perfect', a:'Imperative', h:'Cohortative', j:'Jussive',
  r:'Infinitive Construct', s:'Infinitive Absolute',
  A:'Participle Active', u:'Participle Passive'
};
const NOUN_TYPES = { c:'Common', g:'Gentilic', p:'Proper' };
const GENDER     = { m:'Masc.', f:'Fem.', c:'Com.', b:'Both' };
const NUMBER     = { s:'Sg.', p:'Pl.', d:'Du.' };
const STATE      = { a:'Abs.', c:'Const.', d:'Det.' };
const PERSON     = { 1:'1st', 2:'2nd', 3:'3rd' };
const POS_NAMES  = {
  V:'Verb', N:'Noun', A:'Adjective', P:'Pronoun', S:'Suffix',
  D:'Adverb', R:'Preposition', C:'Conjunction', T:'Particle', M:'Preposition'
};
const PRONOUN_TYPES = { r:'Relative', d:'Demonstrative', f:'Indefinite',
  i:'Interrogative', p:'Personal', s:'Suffix' };

function decodeMorph(morph) {
  if (!morph) return '';
  // Strip language prefix and handle compound (slash-separated) — use last root part
  const clean = morph.replace(/^[HA]/, '');
  // Take the last part after any slashes (root morphology)
  const parts = clean.split('/');
  const root  = parts[parts.length - 1];
  if (!root) return '';

  const pos = root[0];
  const rest = root.slice(1);
  const label = POS_NAMES[pos] || pos;

  if (pos === 'V') {
    // Verb: stem + conjugation + person + gender + number
    const stem  = VERB_STEMS[rest[0]] || '';
    const conj  = VERB_CONJ[rest[1]]  || '';
    const per   = PERSON[rest[2]]     || '';
    const gen   = GENDER[rest[3]]     || '';
    const num   = NUMBER[rest[4]]     || '';
    return [label, stem, conj, per, gen, num].filter(Boolean).join(' · ');
  }
  if (pos === 'N') {
    const type = NOUN_TYPES[rest[0]] || '';
    const gen  = GENDER[rest[1]]     || '';
    const num  = NUMBER[rest[2]]     || '';
    const st   = STATE[rest[3]]      || '';
    return [label, type, gen, num, st].filter(Boolean).join(' · ');
  }
  if (pos === 'A') {
    const gen = GENDER[rest[1]] || '';
    const num = NUMBER[rest[2]] || '';
    const st  = STATE[rest[3]]  || '';
    return [label, gen, num, st].filter(Boolean).join(' · ');
  }
  if (pos === 'P') {
    const type = PRONOUN_TYPES[rest[0]] || '';
    const per  = PERSON[rest[1]]        || '';
    const gen  = GENDER[rest[2]]        || '';
    const num  = NUMBER[rest[3]]        || '';
    return [label, type, per, gen, num].filter(Boolean).join(' · ');
  }
  if (pos === 'S') {
    const per = PERSON[rest[1]] || '';
    const gen = GENDER[rest[2]] || '';
    const num = NUMBER[rest[3]] || '';
    return ['Suffix', per, gen, num].filter(Boolean).join(' · ');
  }
  if (pos === 'R' || pos === 'M') return 'Preposition';
  if (pos === 'C') return 'Conjunction';
  if (pos === 'D') return 'Adverb';
  if (pos === 'T') {
    if (rest === 'o') return 'Direct Object Marker';
    if (rest === 'n') return 'Negative Particle';
    if (rest === 'd') return 'Definite Article';
    if (rest === 'e') return 'Existence Particle';
    if (rest === 'f') return 'Conditional Particle';
    if (rest === 'i') return 'Interrogative Particle';
    return 'Particle';
  }
  return label;
}

// ── Simple XML word extractor ─────────────────────────────────────────────────
// OSHB XML is regular enough for a targeted regex parse
function parseOSHBBook(xml) {
  // Result: { chapter: { verse: [ {w, lemma, morph} ] } }
  const result = {};
  // Extract all verses
  const verseRe = /<verse osisID="[^.]+\.(\d+)\.(\d+)"[^>]*>([\s\S]*?)<\/verse>/g;
  let vm;
  while ((vm = verseRe.exec(xml)) !== null) {
    const ch    = parseInt(vm[1]);
    const vs    = parseInt(vm[2]);
    const body  = vm[3];
    // Extract words
    const wordRe = /<w\b([^>]*)>([\s\S]*?)<\/w>/g;
    let wm;
    const words = [];
    while ((wm = wordRe.exec(body)) !== null) {
      const attrs = wm[1];
      const text  = wm[2].replace(/\//g, '').trim(); // remove morpheme separators
      const lemmaM = attrs.match(/lemma="([^"]+)"/);
      const morphM = attrs.match(/morph="([^"]+)"/);
      words.push({
        raw:   text,
        lemma: lemmaM ? lemmaM[1] : '',
        morph: morphM ? morphM[1] : ''
      });
    }
    if (!result[ch]) result[ch] = {};
    result[ch][vs] = words;
  }
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const output  = {};
  const xmlFiles = Object.keys(BOOK_MAP).sort((a,b) => BOOK_MAP[a] - BOOK_MAP[b]);

  for (const file of xmlFiles) {
    const bookNum = BOOK_MAP[file];
    const filePath = path.join(OSHB_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ Missing: ${file}`);
      continue;
    }
    const xml   = fs.readFileSync(filePath, 'utf8');
    const book  = parseOSHBBook(xml);
    output[bookNum] = {};

    let wordCount = 0;
    for (const [ch, verses] of Object.entries(book)) {
      output[bookNum][ch] = {};
      for (const [vs, words] of Object.entries(verses)) {
        output[bookNum][ch][vs] = words.map(({ raw, lemma, morph }) => {
          const strongs = parseStrongs(lemma);
          const gloss   = getGloss(strongs);
          const translit = getTranslit(strongs);
          const morphEn  = decodeMorph(morph);
          wordCount++;
          return { w: raw, t: translit, g: gloss, s: strongs || '', m: morphEn };
        });
      }
    }
    process.stdout.write(`  ✅ ${file.replace('.xml','')} (Book ${bookNum}) — ${wordCount} words\n`);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(output));
  const size = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ Written: ${OUT_FILE} (${size} MB)`);
}

main().catch(e => { console.error(e); process.exit(1); });
