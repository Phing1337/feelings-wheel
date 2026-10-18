/* Vite plugin: serves the compiled feelings as two virtual modules and reloads the app whenever
   a file in content/ changes. Problems in the YAML show as Vite's error overlay (file:line + message). */
import path from 'node:path';
import { compileFeelings } from './feelings/compile.js';

const DATA = 'virtual:feelings', CONTENT = 'virtual:feelings/content';
const norm = p => path.resolve(p).replace(/\\/g, '/').toLowerCase();

export default function feelingsData(opts = {}) {
  let dir, result = null, logger, dev = false;
  const build = () => {
    if (result) return result;
    result = compileFeelings(dir);
    const s = result.stats;
    logger?.info(`  feelings: ${s.feelings} feelings · ${s.synonyms + s.deep} synonyms · ${s.words} words · ${s.examples} examples · ${s.clusters} clusters` +
      (result.warnings.length ? ` · ${result.warnings.length} warnings (npm run words:check)` : ''), { timestamp: true });
    return result;
  };
  return {
    name: 'feelings-data',
    configResolved(c) { dir = path.resolve(c.root, opts.dir || 'content'); logger = c.logger; dev = c.command === 'serve'; },
    resolveId(id) { if (id === DATA || id === CONTENT) return '\0' + id; },
    load(id) {
      if (id !== '\0' + DATA && id !== '\0' + CONTENT) return;
      let r;
      try { r = build(); } catch (e) { e.message = 'Feelings content has problems:\n' + e.message; throw e; }
      r.files.forEach(f => this.addWatchFile(f));
      if (id === '\0' + CONTENT) return `export default ${JSON.stringify(r.content)};`;
      return `export default ${JSON.stringify(r.data)};\nexport const warnings = ${dev ? JSON.stringify(r.warnings) : '[]'};`;
    },
    configureServer(server) {
      server.watcher.add(dir);
      const root = norm(dir);
      const onFs = file => {
        if (!norm(file).startsWith(root) || !/\.ya?ml$/i.test(file)) return;
        result = null;
        [DATA, CONTENT].forEach(v => { const m = server.moduleGraph.getModuleById('\0' + v); if (m) server.moduleGraph.invalidateModule(m); });
        server.ws.send({ type: 'full-reload' });
      };
      ['add', 'change', 'unlink'].forEach(ev => server.watcher.on(ev, onFs));
    },
    handleHotUpdate(ctx) { if (norm(ctx.file).startsWith(norm(dir))) return []; }
  };
}
