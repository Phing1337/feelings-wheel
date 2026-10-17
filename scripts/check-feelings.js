/* npm run words:check — validates content/ and prints totals, warnings and errors.
   Add --strict to fail on warnings too (handy before publishing). */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileFeelings } from './feelings/compile.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const strict = process.argv.includes('--strict');
try {
  const { stats, warnings, data } = compileFeelings(dir);
  console.log(`\n✔ ${stats.feelings} feelings · ${stats.words} searchable words · ${stats.examples} examples · ${stats.clusters} clusters\n`);
  const sizes = data.clusters.map(c => `${c.name} ${c.members.length}`).join(' · ');
  console.log(`  ${sizes}\n`);
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
