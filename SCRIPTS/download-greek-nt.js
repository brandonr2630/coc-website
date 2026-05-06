#!/usr/bin/env node
/**
 * download-greek-nt.js
 * Builds greek-nt.json from:
 *   - @metaxia/scriptures-source-stepbible-tagnt-tr  (TAGNT Textus Receptus — CC-BY 4.0)
 *   - @metaxia/scriptures-source-stepbible-lexicon   (STEPBible Greek lexicon — CC-BY 4.0)
 *
 * Output: ./greek-nt.json
 *   { bookNum: { chapter: { verse: [ {w, t, g, s, m} ] } } }
 *   w = Greek word text
 *   t = transliteration
 *   g = English gloss
 *   s = Strong's number (e.g. "G976")
 *   m = morphology in plain English
 *
 * Usage:  node download-greek-nt.js
 * Requires: npm install @metaxia/scriptures-source-stepbible-tagnt-tr
 *                       @metaxia/scriptures-source-stepbible-lexicon
 */

'use strict';
const fs   = require('fs');
const path = require('path');

// ── Data sources ──────────────────────────────────────────────────────────────
const TAGNT_DIR = path.join(__dirname, 'node_modules/@metaxia/scriptures-source-stepbible-tagnt-tr/data/stepbible-tagnt-tr');
const LEXICON_G = path.join(__dirname, 'node_modules/@metaxia/scriptures-source-stepbible-lexicon/data/stepbible-tbesg.json');
const OUT_FILE  = path.join(__dirname, 'greek-nt.json');

// ── NT book map: folder name → canonical book number (40-66) ─────────────────
const BOOK_MAP = {
  'Matt':40,'Mark':41,'Luke':42,'John':43,'Acts':44,
  'Rom':45,'1Cor':46,'2Cor':47,'Gal':48,'Eph':49,
  'Phil':50,'Col':51,'1Thess':52,'2Thess':53,'1Tim':54,
  '2Tim':55,'Titus':56,'Phlm':57,'Heb':58,'Jas':59,
  '1Pet':60,'2Pet':61,'1John':62,'2John':63,'3John':64,
  'Jude':65,'Rev':66
};

// ── Load lexicon ──────────────────────────────────────────────────────────────
console.log('Loading Greek lexicon…');
const lexG = JSON.parse(fs.readFileSync(LEXICON_G, 'utf8'));

function getGlossAndTranslit(strongsRaw) {
  if (!strongsRaw) return { g: '', t: '' };
  // Normalize: G0976 → G0976, G976 → try both
  const norm    = strongsRaw.replace(/^G0*/, s => 'G' + s.slice(1).replace(/^0+/, ''));
  const padded  = strongsRaw.startsWith('G') ?
    'G' + strongsRaw.slice(1).padStart(4, '0') : strongsRaw;
  const entry   = lexG[padded] || lexG[strongsRaw] || lexG[norm];
  if (!entry) return { g: '', t: '' };
  return {
    g: (entry.gloss || '').split(':')[0].trim(),
    t: entry.transliteration || ''
  };
}

// ── Robinson morphology decoder ───────────────────────────────────────────────
// Format from TAGNT-TR: "robinson:N-NSF", "robinson:V-AAI-3S", "robinson:CONJ" etc.

const GK_CASE   = { N:'Nom.', G:'Gen.', D:'Dat.', A:'Acc.', V:'Voc.' };
const GK_NUMBER = { S:'Sg.', P:'Pl.' };
const GK_GENDER = { M:'Masc.', F:'Fem.', N:'Neut.' };
const GK_TENSE  = { P:'Pres.', I:'Impf.', F:'Fut.', A:'Aor.', X:'Perf.', Y:'Plpf.' };
const GK_VOICE  = { A:'Act.', M:'Mid.', P:'Pass.', E:'Mid./Pass.', D:'Mid.' };
const GK_MOOD   = {
  I:'Indic.', S:'Subj.', O:'Opt.', M:'Impv.', N:'Inf.', P:'Ptc.'
};
const GK_PERSON = { 1:'1st', 2:'2nd', 3:'3rd' };
const GK_DEGREE = { C:'Comp.', S:'Superl.' };

function decodeRobinson(morph) {
  if (!morph) return '';
  const code = morph.replace(/^robinson:/, '').trim();

  // Simple fixed-label parts of speech
  const fixedLabels = {
    'CONJ':'Conjunction', 'COND':'Conditional', 'PRT':'Particle',
    'PREP':'Preposition', 'INJ':'Interjection', 'ARAM':'Aramaic',
    'HEB':'Hebrew', 'N-PRI':'Proper Noun (Indecl.)', 'A-NUI':'Numeral (Indecl.)',
    'N-LI':'Letter', 'N-OI':'Noun (Indecl.)', 'ADV':'Adverb',
    'ADV-I':'Interrogative Adv.', 'ADV-N':'Negative Adv.',
    'PRT-N':'Negative Particle', 'PRT-I':'Interrogative Particle'
  };
  if (fixedLabels[code]) return fixedLabels[code];

  // Split into segments by dash
  const segs = code.split('-');
  const pos  = segs[0];
  const rest = segs.slice(1);

  // Part of speech labels
  const posLabels = {
    N:'Noun', V:'Verb', A:'Adjective', T:'Article',
    P:'Personal Pronoun', R:'Relative Pronoun', C:'Reciprocal Pronoun',
    D:'Demonstrative Pronoun', K:'Correlative Pronoun', I:'Interrogative Pronoun',
    X:'Indefinite Pronoun', Q:'Correlative/Interrogative', F:'Reflexive Pronoun',
    S:'Possessive Pronoun'
  };
  const label = posLabels[pos] || pos;

  if (pos === 'V') {
    // Verb: TAM-PNS (Tense-Voice-Mood — Person-Number-Gender-State)
    const tam  = rest[0] || '';
    const pns  = rest[1] || '';
    const tense  = GK_TENSE[tam[0]]  || '';
    const voice  = GK_VOICE[tam[1]]  || '';
    const mood   = GK_MOOD[tam[2]]   || '';
    const person = GK_PERSON[pns[0]] || '';
    const number = GK_NUMBER[pns[1]] || '';
    const gender = GK_GENDER[pns[2]] || '';
    const degree = GK_DEGREE[tam[3]] || '';
    return [label, tense, voice, mood, person, number, gender, degree]
      .filter(Boolean).join(' · ');
  }

  if (['N','T'].includes(pos)) {
    // Noun / Article: Case+Number+Gender
    const cng = rest[0] || '';
    const c = GK_CASE[cng[0]]   || '';
    const n = GK_NUMBER[cng[1]] || '';
    const g = GK_GENDER[cng[2]] || '';
    const suffix = rest[1] || '';
    const proper = suffix === 'P' ? ' · Proper' : '';
    return [label, c, n, g].filter(Boolean).join(' · ') + proper;
  }

  if (['A','S','P','R','C','D','K','I','X','Q','F'].includes(pos)) {
    const cng = rest[0] || '';
    const c = GK_CASE[cng[0]]   || '';
    const n = GK_NUMBER[cng[1]] || '';
    const g = GK_GENDER[cng[2]] || '';
    const deg = rest[1] ? (GK_DEGREE[rest[1][0]] || '') : '';
    return [label, c, n, g, deg].filter(Boolean).join(' · ');
  }

  return label;
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  const output  = {};
  const books   = Object.keys(BOOK_MAP).sort((a,b) => BOOK_MAP[a] - BOOK_MAP[b]);

  for (const bookFolder of books) {
    const bookNum  = BOOK_MAP[bookFolder];
    const bookDir  = path.join(TAGNT_DIR, bookFolder);
    if (!fs.existsSync(bookDir)) {
      console.warn(`  ⚠ Missing: ${bookFolder}`);
      continue;
    }

    output[bookNum] = {};
    const chapters = fs.readdirSync(bookDir)
      .filter(f => !f.includes('.'))
      .map(Number).sort((a,b) => a - b);

    let wordCount = 0;
    for (const ch of chapters) {
      output[bookNum][ch] = {};
      const chDir  = path.join(bookDir, String(ch));
      const verses = fs.readdirSync(chDir)
        .filter(f => f.endsWith('.json'))
        .map(f => parseInt(f)).sort((a,b) => a - b);

      for (const vs of verses) {
        const vsFile = path.join(chDir, `${vs}.json`);
        const data   = JSON.parse(fs.readFileSync(vsFile, 'utf8'));
        output[bookNum][ch][vs] = (data.words || []).map(word => {
          // Normalise Strong's: "G0976" → "G976" for consistency with existing lexicon
          const rawStrongs = (word.strongs || [])[0] || '';
          const sNum = rawStrongs.replace(/^G0+/, 'G').replace(/G$/, ''); // strip trailing letters
          const { g: glossFromData } = { g: word.metadata?.gloss || '' };
          const { g: glossFromLex, t: translit } = getGlossAndTranslit(rawStrongs);
          const gloss = glossFromData || glossFromLex;
          const morph = decodeRobinson(word.morph || '');
          wordCount++;
          return {
            w: word.text   || '',
            t: word.metadata?.transliteration || translit,
            g: gloss,
            s: sNum,
            m: morph
          };
        });
      }
    }
    process.stdout.write(`  ✅ ${bookFolder} (Book ${bookNum}) — ${wordCount} words\n`);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(output));
  const size = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ Written: ${OUT_FILE} (${size} MB)`);
}

main();
