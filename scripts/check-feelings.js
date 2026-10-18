/* npm run words:check — validates content/ and prints totals, warnings and errors.
   Add --strict to fail on warnings too (handy before publishing). */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileFeelings } from './feelings/compile.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const strict = process.argv.includes('--strict');
try {
  const { stats, warnings, data } = compileFeelings(dir);
  console.log(`\n✔ ${stats.feelings} feelings · ${stats.synonyms} synonyms · ${stats.deep} deep words · ${stats.words} searchable words · ${stats.examples} examples · ${stats.clusters} clusters\n`);
  const sizes = data.clusters.map(c => {
    const own = data.feelings.filter(f => f.cluster === c.id);
    const syn = own.reduce((n, f) => n + (f.syn?.length || 0), 0);
    return `${c.name} ${c.members.length}${syn ? ` (+${syn})` : ''}`;
  }).join(' · ');
  console.log(`  ${sizes}\n`);
  const bare = data.feelings.filter(f => !f.syn).map(f => f.word);
  if (bare.length && bare.length < data.feelings.length) console.log(`  ${bare.length} feelings without synonyms yet: ${bare.slice(0, 12).join(', ')}${bare.length > 12 ? ', …' : ''}\n`);
  if (warnings.length) {
    console.log(`⚠ ${warnings.length} warning${warnings.length > 1 ? 's' : ''}`);
    warnings.forEach(w => console.log(`  ${w.where}  ${w.msg}`));
    console.log('');
  }
  process.exit(strict && warnings.length ? 1 : 0);
} catch (e) {
  console.error(`\n✖ ${e.name === 'FeelingsError' ? 'Problems in content/' : e.name}\n`);
  console.error((e.message || String(e)).split('\n').map(l => '  ' + l).join('\n') + '\n');
  process.exit(1);
}
