/* npm run words:check [deck] — validates every deck (scripts/feelings/decks.js) and prints totals,
   warnings and errors. Name a deck (feelings, people) to check just that one; add --strict
   (npm run words:check -- --strict) to fail on warnings too — handy before publishing. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileFeelings } from './feelings/compile.js';
import { DECKS } from './feelings/decks.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const only = args.filter(a => !a.startsWith('-'));
const unknown = only.filter(id => !DECKS[id]);
if (unknown.length) {
  console.error(`\n✖ no deck called ${unknown.join(', ')} — use ${Object.keys(DECKS).join(', ')}\n`);
  process.exit(1);
}

let failed = false;
for (const [id, dir] of Object.entries(DECKS)) {
  if (only.length && !only.includes(id)) continue;
  try {
    const { stats, warnings, data, deck } = compileFeelings(path.resolve(root, dir), { root, id });
    const n = deck.noun;
    console.log(`\n✔ ${deck.name}: ${stats.feelings} ${n}s · ${stats.synonyms} synonyms · ${stats.deep} deep words · ${stats.words} searchable words · ${stats.examples} examples · ${stats.clusters} clusters`);
    if (stats.sides) console.log(`  ${Object.entries(stats.sides).map(([s, k]) => `${k} ${s}`).join(' · ')}`);
    const sizes = data.clusters.map(c => {
      const own = data.feelings.filter(f => f.cluster === c.id);
      const syn = own.reduce((k, f) => k + (f.syn?.length || 0), 0);
      return `${c.name} ${c.members.length}${syn ? ` (+${syn})` : ''}`;
    }).join(' · ');
    console.log(`\n  ${sizes}\n`);
    const bare = data.feelings.filter(f => !f.syn).map(f => f.word);
    if (bare.length && bare.length < data.feelings.length) console.log(`  ${bare.length} ${n}s without synonyms yet: ${bare.slice(0, 12).join(', ')}${bare.length > 12 ? ', …' : ''}\n`);
    if (warnings.length) {
      console.log(`⚠ ${warnings.length} warning${warnings.length > 1 ? 's' : ''}`);
      warnings.forEach(w => console.log(`  ${w.where}  ${w.msg}`));
      console.log('');
      if (strict) failed = true;
    }
  } catch (e) {
    console.error(`\n✖ ${e.name === 'FeelingsError' ? `Problems in ${dir}/` : e.name}\n`);
    console.error((e.message || String(e)).split('\n').map(l => '  ' + l).join('\n') + '\n');
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
