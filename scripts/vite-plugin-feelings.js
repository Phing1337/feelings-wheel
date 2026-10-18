/* Vite plugin: compiles every deck (scripts/feelings/decks.js) and serves them as one virtual module,
   `virtual:decks`. Editing any deck's YAML recompiles and reloads the app; problems show as Vite's
   error overlay (file:line + message). */
import path from 'node:path';
import { compileFeelings } from './feelings/compile.js';
import { DECKS } from './feelings/decks.js';

const ID = 'virtual:decks';
const norm = p => path.resolve(p).replace(/\\/g, '/').toLowerCase();

export default function feelingsData(opts = {}) {
  let root, decks, dirs = [], result = null, logger, dev = false;
  const inDecks = file => dirs.some(d => norm(file).startsWith(d));
  const build = () => {
    if (result) return result;
    const out = {};
    for (const [id, dir] of Object.entries(decks)) {
      try { out[id] = compileFeelings(path.resolve(root, dir), { root, id }); }
      catch (e) { e.message = `The ${id} deck has problems:\n` + e.message; throw e; }
      const r = out[id], s = r.stats;
      logger?.info(`  ${id}: ${s.feelings} ${r.deck.noun}s · ${s.synonyms + s.deep} synonyms · ${s.words} words · ${s.examples} examples · ${s.clusters} clusters` +
        (r.warnings.length ? ` · ${r.warnings.length} warnings (npm run words:check ${id})` : ''), { timestamp: true });
    }
    return (result = out);
  };
  return {
    name: 'feelings-data',
    configResolved(c) {
      root = c.root; decks = opts.decks || DECKS; logger = c.logger; dev = c.command === 'serve';
      dirs = Object.values(decks).map(d => norm(path.resolve(root, d)));
    },
    resolveId(id) { if (id === ID) return '\0' + ID; },
    load(id) {
      if (id !== '\0' + ID) return;
      const all = build();
      Object.values(all).forEach(r => r.files.forEach(f => this.addWatchFile(f)));
      const pick = fn => Object.fromEntries(Object.entries(all).map(([k, r]) => [k, fn(r)]));
      return `export default ${JSON.stringify(pick(r => ({ data: r.data, content: r.content })))};\n` +
        `export const warnings = ${JSON.stringify(dev ? pick(r => r.warnings) : {})};`;
    },
    configureServer(server) {
      Object.values(decks).forEach(d => server.watcher.add(path.resolve(root, d)));
      const onFs = file => {
        if (!/\.ya?ml$/i.test(file) || !inDecks(file)) return;
        result = null;
        const m = server.moduleGraph.getModuleById('\0' + ID);
        if (m) server.moduleGraph.invalidateModule(m);
        server.ws.send({ type: 'full-reload' });
      };
      ['add', 'change', 'unlink'].forEach(ev => server.watcher.on(ev, onFs));
    },
    handleHotUpdate(ctx) { if (inDecks(ctx.file)) return []; }
  };
}
