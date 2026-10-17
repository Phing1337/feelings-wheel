/* Compiles content/families.yaml + content/clusters/*.yaml into the app's data.
   Shared by the Vite plugin (live reload while you edit) and `npm run words:check`.
   See content/README.md for the authoring format. */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export const TAGS = ['text', 'say', 'opener', 'self'];
export const LINKS = ['stronger', 'softer', 'opposite', 'under', 'see'];
const FEELING_KEYS = new Set(['word', 'id', 'core', 'mix', 'level', 'def', 'aliases', 'hy', 'also', 'body', 'voice', 'note', ...LINKS, ...TAGS]);
const CLUSTER_KEYS = new Set(['id', 'name', 'family', 'anchor', 'mix', 'level', 'blurb', 'near', 'feelings', 'note']);
const FAMILY_KEYS = new Set(['id', 'name', 'color', 'angle']);

export const slug = w => String(w).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/['\u2019]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const list = v => (v == null ? [] : Array.isArray(v) ? v : [v]).map(x => String(x).trim()).filter(Boolean);
const text = v => (v == null ? '' : String(v).trim());

export class FeelingsError extends Error {
  constructor(problems) {
    super(problems.map(p => `${p.where}  ${p.msg}`).join('\n'));
    this.name = 'FeelingsError';
    this.problems = problems;
  }
}

function readYaml(file, rel, fail) {
  const lc = new YAML.LineCounter();
  const doc = YAML.parseDocument(fs.readFileSync(file, 'utf8'), { lineCounter: lc, prettyErrors: true });
  if (doc.errors.length) { doc.errors.forEach(e => fail(`${rel}:${e.linePos?.[0]?.line ?? '?'}`, e.message.split('\n')[0])); return null; }
  return { doc, js: doc.toJS() || {}, line: node => (node?.range ? lc.linePos(node.range[0]).line : '?') };
}

/* "joyful 6 peaceful 4", "joyful 60, peaceful 40%", "joyful + peaceful" or { joyful: 0.6, peaceful: 0.4 } */
export function parseMix(v, fams, bad) {
  if (v == null || v === '') return null;
  let pairs = [];
  if (typeof v === 'string') {
    const t = v.replace(/[,+/&]/g, ' ').trim().split(/\s+/);
    for (let i = 0; i < t.length; i++) {
      const name = t[i].toLowerCase();
      let w = 1;
      if (/^\d+(\.\d+)?%?$/.test(t[i + 1] || '')) { w = parseFloat(t[i + 1]); i++; }
      pairs.push([name, w]);
    }
  } else if (typeof v === 'object' && !Array.isArray(v)) pairs = Object.entries(v).map(([k, w]) => [k.toLowerCase(), Number(w)]);
  else { bad('mix should look like "joyful 6 peaceful 4"'); return null; }
  const out = {};
  for (const [k, w] of pairs) {
    if (!fams.has(k)) { bad(`unknown family "${k}" in mix — use ${[...fams].join(', ')}`); continue; }
    if (!(w > 0)) { bad(`mix weight for "${k}" must be more than 0`); continue; }
    out[k] = (out[k] || 0) + w;
  }
  const tot = Object.values(out).reduce((a, b) => a + b, 0);
  return tot ? Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]).map(([k, w]) => [k, +(w / tot).toFixed(3)])) : null;
}

export function compileFeelings(dir) {
  const errors = [], warnings = [], files = [];
  const fail = (where, msg) => errors.push({ where, msg });
  const warn = (where, msg) => warnings.push({ where, msg });
  const relOf = f => path.relative(path.dirname(dir), f).replace(/\\/g, '/');

  /* ---- families ---- */
  const famFile = path.join(dir, 'families.yaml');
  files.push(famFile);
  if (!fs.existsSync(famFile)) throw new FeelingsError([{ where: relOf(famFile), msg: 'missing — it lists the six colour families' }]);
  const fy = readYaml(famFile, relOf(famFile), fail);
  const families = [];
  (Array.isArray(fy?.js) ? fy.js : []).forEach((F, i) => {
    const where = `${relOf(famFile)}:${fy.line(fy.doc.contents.items[i])}`;
    Object.keys(F).forEach(k => FAMILY_KEYS.has(k) || warn(where, `unknown field "${k}"`));
    if (!F.id || !F.name || !/^#[0-9a-f]{6}$/i.test(F.color || '') || typeof F.angle !== 'number') return fail(where, 'each family needs id, name, color (#RRGGBB) and angle');
    families.push({ id: slug(F.id), name: text(F.name), color: F.color.toUpperCase(), angle: F.angle });
  });
  if (fy && !families.length) fail(relOf(famFile), 'no families found');
  const fams = new Set(families.map(F => F.id));

  /* ---- clusters + feelings ---- */
  const cdir = path.join(dir, 'clusters');
  const cfiles = fs.existsSync(cdir) ? fs.readdirSync(cdir).filter(f => /\.ya?ml$/i.test(f)).sort() : [];
  if (!cfiles.length) fail(relOf(cdir), 'no cluster files found');
  const clusters = [], feelings = [], content = {}, where = {}, raw = [];

  for (const name of cfiles) {
    const file = path.join(cdir, name), rel = relOf(file);
    files.push(file);
    const y = readYaml(file, rel, fail);
    if (!y) continue;
    const C = y.js, cw = `${rel}:1`;
    Object.keys(C).forEach(k => CLUSTER_KEYS.has(k) || warn(cw, `unknown cluster field "${k}"`));
    const id = slug(C.id || name.replace(/\.ya?ml$/i, ''));
    if (clusters.some(c => c.id === id)) { fail(cw, `cluster id "${id}" is used twice`); continue; }
    const family = slug(C.family || '');
    if (!fams.has(family)) fail(cw, `cluster needs a family: ${[...fams].join(', ')}`);
    const cmix = parseMix(C.mix, fams, m => fail(cw, m));
    const cluster = { id, name: text(C.name) || id, family, blurb: text(C.blurb), anchor: C.anchor ? slug(C.anchor) : '', members: [], _near: C.near, _where: cw };
    if (C.level != null && !(C.level >= 0 && C.level <= 5)) fail(cw, 'level should be 0–5');
    clusters.push(cluster);

    const seq = y.doc.get('feelings', true);
    (Array.isArray(C.feelings) ? C.feelings : []).forEach((e, i) => {
      const fw = `${rel}:${y.line(seq?.items?.[i])}`;
      if (!e || typeof e !== 'object' || !text(e.word)) return fail(fw, 'each feeling needs a word');
      Object.keys(e).forEach(k => FEELING_KEYS.has(k) || warn(fw, `unknown field "${k}" on "${e.word}"`));
      const fid = slug(e.id || e.word);
      if (where[fid]) return fail(fw, `"${e.word}" is already in ${where[fid]} — list the cluster in its "also" instead`);
      where[fid] = fw;
      const level = e.level ?? C.level ?? 3;
      if (!(Number.isFinite(level) && level >= 0 && level <= 5)) fail(fw, `level for "${e.word}" should be 0–5`);
      const mix = parseMix(e.mix, fams, m => fail(fw, m)) || cmix || (fams.has(family) ? { [family]: 1 } : {});
      const def = text(e.def);
      if (!def) warn(fw, `"${e.word}" has no def`);
      const f = { id: fid, word: text(e.word), mix, level, def, cluster: id };
      if (e.core) f.core = true;
      if (e.hy) f.hy = text(e.hy);
      const al = list(e.aliases); if (al.length) f.aliases = al;
      cluster.members.push(fid);
      feelings.push(f);
      raw.push({ f, e, fw });

      const c = {}, ex = [];
      if (e.body) c.body = text(e.body);
      const voice = list(e.voice); if (voice.length) c.voice = voice;
      Object.keys(e).forEach(k => TAGS.includes(k) && list(e[k]).forEach(s => ex.push({ tag: k, s })));
      if (ex.length) c.examples = ex;
      if (Object.keys(c).length) content[fid] = c;
    });
    if (!cluster.members.length) warn(cw, `cluster "${id}" has no feelings yet`);
  }

  /* ---- resolve words → ids (aliases count too) ---- */
  const ids = new Set(feelings.map(f => f.id)), alias = {};
  feelings.forEach(f => (f.aliases || []).forEach(a => {
    const s = slug(a);
    if (ids.has(s)) warn(where[f.id], `alias "${a}" on "${f.word}" is already its own feeling`);
    else alias[s] = alias[s] || f.id;
  }));
  const resolve = (w, fw, why) => { const s = slug(w); if (ids.has(s)) return s; if (alias[s]) return alias[s]; warn(fw, `${why} "${w}" isn't a feeling yet`); return null; };
  const cids = new Set(clusters.map(c => c.id));
  const byCluster = Object.fromEntries(clusters.map(c => [c.id, c]));

  for (const { f, e, fw } of raw) {
    const links = {};
    LINKS.forEach(k => {
      const out = list(e[k]).map(w => resolve(w, fw, `${k} →`)).filter(x => x && x !== f.id);
      if (out.length) links[k] = [...new Set(out)];
    });
    if (Object.keys(links).length) f.links = links;
    const also = list(e.also).map(slug).filter(c => {
      if (!cids.has(c)) { warn(fw, `also → unknown cluster "${c}"`); return false; }
      return c !== f.cluster;
    });
    if (also.length) { f.also = also; also.forEach(c => byCluster[c].members.push(f.id)); }
  }

  for (const c of clusters) {
    if (c.anchor && !c.members.includes(c.anchor)) {
      const r = resolve(c.anchor, c._where, 'anchor');
      c.anchor = r && c.members.includes(r) ? r : '';
      if (r && !c.anchor) warn(c._where, `anchor "${r}" isn't in this cluster`);
    }
    c.anchor = c.anchor || c.members[0] || '';
  }
  for (const c of clusters) {
    const near = c._near == null ? {} : Array.isArray(c._near) || typeof c._near === 'string'
      ? Object.fromEntries(list(c._near).map(n => [n, null])) : c._near;
    c.near = Object.entries(near).flatMap(([n, via]) => {
      const nid = slug(n);
      if (!cids.has(nid)) { warn(c._where, `near → unknown cluster "${n}"`); return []; }
      if (nid === c.id) return [];
      const v = list(via).map(w => resolve(w, c._where, `near ${nid} via`)).filter(Boolean);
      return [{ id: nid, via: v.length ? v : [byCluster[nid].anchor || byCluster[nid].members[0]].filter(Boolean) }];
    });
    delete c._near; delete c._where;
  }

  /* ---- every family needs exactly one core feeling (the home bubbles) ---- */
  families.forEach(F => {
    const cores = feelings.filter(f => f.core && Object.keys(f.mix)[0] === F.id);
    if (cores.length !== 1) fail(relOf(cdir), `family "${F.id}" needs exactly one feeling with core: true (found ${cores.length})`);
  });

  if (errors.length) throw new FeelingsError(errors);
  const examples = Object.values(content).reduce((n, c) => n + (c.examples || []).length, 0);
  const stats = { families: families.length, clusters: clusters.length, feelings: feelings.length, words: feelings.length + Object.keys(alias).length, examples };
  return { data: { families, clusters, feelings }, content, warnings, stats, files };
}
