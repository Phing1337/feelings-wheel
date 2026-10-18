/* Compiles a deck of words — <dir>/families.yaml + <dir>/clusters/*.yaml — into the app's data.
   content/ is the feelings deck; content/people/ is the people deck, which describes its own
   example lines and fields in deck.yaml. Shared by the Vite plugin (live reload while you edit)
   and `npm run words:check`. See content/README.md for the authoring format. */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export const TAGS = ['text', 'say', 'opener', 'self'];
export const LINKS = ['stronger', 'softer', 'opposite', 'under', 'see'];
const LINK_KINDS = [...LINKS, 'shadow'];
const BASE_KEYS = ['word', 'id', 'core', 'mix', 'level', 'def', 'aliases', 'hy', 'also', 'note', 'synonyms', 'deep'];
const SYN_KEYS = new Set(['word', 'means', 'sounds', 'from', 'lang']);
const CLUSTER_KEYS = new Set(['id', 'name', 'family', 'anchor', 'mix', 'level', 'side', 'blurb', 'near', 'feelings', 'words', 'note']);
const FAMILY_KEYS = new Set(['id', 'name', 'color', 'angle']);
const DECK_KEYS = new Set(['id', 'name', 'noun', 'tags', 'fields', 'links', 'sides', 'note']);
/* the feelings (content/) need no deck.yaml — this is their shape */
export const FEELINGS_DECK = {
  id: 'feelings', name: 'Feelings', noun: 'feeling',
  tags: { text: 'Text', say: 'Say it', opener: 'Opener', self: 'To myself' },
  fields: { body: 'text', voice: 'list' }, links: LINKS, sides: []
};

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

/* thesaurus words: "glad", or "sanguine: cheerfully hopeful…" with optional sounds / from / lang lines */
function parseSyn(v, bad) {
  if (typeof v === 'string' || typeof v === 'number') return text(v) ? { word: text(v) } : null;
  if (!v || typeof v !== 'object' || Array.isArray(v)) { bad('write each one as a word, or "word: what it means"'); return null; }
  const keys = Object.keys(v), extra = keys.filter(k => !SYN_KEYS.has(k));
  let word = text(v.word), means = text(v.means);
  if (!word) {
    if (extra.length !== 1) { bad(`can't tell which key is the word in { ${keys.join(', ')} }`); return null; }
    const val = v[extra[0]];
    if (val && typeof val === 'object') { bad(`"${extra[0]}" — put its meaning on the same line, and sounds/from/lang level with the word`); return null; }
    word = text(extra[0]); means = means || text(val);
  } else if (extra.length) bad(`unknown field "${extra[0]}" on "${word}"`);
  const s = { word };
  if (means) s.means = means;
  ['sounds', 'from', 'lang'].forEach(k => { if (text(v[k])) s[k] = text(v[k]); });
  return s;
}

/* deck.yaml names a deck and says which example lines (tags), extra fields, links and sides its words use */
function readDeck(file, relOf, fail, warn, idHint) {
  if (!fs.existsSync(file)) return { ...FEELINGS_DECK, id: idHint || FEELINGS_DECK.id };
  const rel = relOf(file), w = `${rel}:1`;
  const D = readYaml(file, rel, fail)?.js || {};
  Object.keys(D).forEach(k => DECK_KEYS.has(k) || warn(w, `unknown deck field "${k}"`));
  const map = (v, what) => {
    if (v == null) return {};
    if (typeof v === 'object' && !Array.isArray(v)) return v;
    fail(w, `${what} should be "name: value" lines`); return {};
  };
  const tags = {}, fields = {};
  Object.entries(map(D.tags, 'tags')).forEach(([k, v]) => { tags[k] = text(v) || k; });
  Object.entries(map(D.fields, 'fields')).forEach(([k, v]) => {
    const kind = text(v) || 'text';
    if (kind === 'text' || kind === 'list') fields[k] = kind; else fail(w, `field "${k}" should be text or list`);
  });
  const links = D.links == null ? [...LINKS] : list(D.links).filter(k => {
    if (LINK_KINDS.includes(k)) return true;
    fail(w, `unknown link "${k}" — use ${LINK_KINDS.join(', ')}`); return false;
  });
  const seen = new Set(BASE_KEYS.concat('side'));
  [...Object.keys(tags), ...Object.keys(fields), ...links].forEach(k => {
    if (seen.has(k)) fail(w, `"${k}" is already a field — tags, fields and links each need their own name`);
    seen.add(k);
  });
  const id = slug(idHint || D.id || path.basename(path.dirname(file)));
  return { id, name: text(D.name) || id, noun: text(D.noun) || 'word', tags, fields, links, sides: list(D.sides).map(slug) };
}

export function compileFeelings(dir, opts = {}) {
  const errors = [], warnings = [], files = [];
  const fail = (where, msg) => errors.push({ where, msg });
  const warn = (where, msg) => warnings.push({ where, msg });
  const relOf = f => path.relative(opts.root || path.dirname(dir), f).replace(/\\/g, '/');

  /* ---- deck: content/ (feelings) has no deck.yaml; other decks describe themselves ---- */
  const deckFile = path.join(dir, 'deck.yaml');
  if (fs.existsSync(deckFile)) files.push(deckFile);
  const deck = readDeck(deckFile, relOf, fail, warn, opts.id);
  const noun = deck.noun, TAGK = Object.keys(deck.tags), FIELDK = Object.keys(deck.fields), SIDES = deck.sides;
  const ENTRY_KEYS = new Set([...BASE_KEYS, ...FIELDK, ...TAGK, ...deck.links, ...(SIDES.length ? ['side'] : [])]);

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
  const clusters = [], feelings = [], content = {}, where = {}, raw = [], rawSyn = [];

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
    const cside = C.side == null ? '' : slug(C.side);
    if (cside) {
      if (SIDES.includes(cside)) cluster.side = cside;
      else fail(cw, SIDES.length ? `side should be ${SIDES.join(', ')}` : 'this deck has no sides');
    }
    clusters.push(cluster);

    if (C.words != null && C.feelings != null) fail(cw, 'list the words under words: or feelings:, not both');
    const key = C.words != null ? 'words' : 'feelings';
    const seq = y.doc.get(key, true);
    (Array.isArray(C[key]) ? C[key] : []).forEach((e, i) => {
      const fw = `${rel}:${y.line(seq?.items?.[i])}`;
      if (!e || typeof e !== 'object' || !text(e.word)) return fail(fw, `each ${noun} needs a word`);
      Object.keys(e).forEach(k => ENTRY_KEYS.has(k) || warn(fw, `unknown field "${k}" on "${e.word}"`));
      const fid = slug(e.id || e.word);
      if (where[fid]) return fail(fw, `"${e.word}" is already in ${where[fid]} — list the cluster in its "also" instead`);
      where[fid] = fw;
      const level = e.level ?? C.level ?? 3;
      if (!(Number.isFinite(level) && level >= 0 && level <= 5)) fail(fw, `level for "${e.word}" should be 0–5`);
      const mix = parseMix(e.mix, fams, m => fail(fw, m)) || cmix || (fams.has(family) ? { [family]: 1 } : {});
      const def = text(e.def);
      if (!def) warn(fw, `"${e.word}" has no def`);
      const f = { id: fid, word: text(e.word), mix, level, def, cluster: id };
      if (SIDES.length) {
        const side = e.side == null ? cluster.side || SIDES[0] : slug(e.side);
        if (SIDES.includes(side)) f.side = side; else fail(fw, `side for "${e.word}" should be ${SIDES.join(', ')}`);
      }
      if (e.core) f.core = true;
      if (e.hy) f.hy = text(e.hy);
      const al = list(e.aliases); if (al.length) f.aliases = al;
      cluster.members.push(fid);
      feelings.push(f);
      raw.push({ f, e, fw });

      const syn = [];
      [['synonyms', false], ['deep', true]].forEach(([key, deep]) => {
        if (e[key] == null) return;
        (Array.isArray(e[key]) ? e[key] : [e[key]]).forEach(v => {
          const s = parseSyn(v, m => warn(fw, `${key} on "${e.word}": ${m}`));
          if (!s) return;
          if (deep) {
            s.deep = true;
            if (!s.means) warn(fw, `deep word "${s.word}" on "${e.word}" needs a short meaning — "${s.word}: what it means"`);
          }
          if ((s.means || '').length > 110) warn(fw, `meaning of "${s.word}" is long — aim for one short line`);
          syn.push(s);
        });
      });
      if (syn.length) rawSyn.push({ f, syn, fw });

      const c = {}, ex = [];
      FIELDK.forEach(k => {
        if (deck.fields[k] === 'list') { const v = list(e[k]); if (v.length) c[k] = v; }
        else if (text(e[k])) c[k] = text(e[k]);
      });
      Object.keys(e).forEach(k => TAGK.includes(k) && list(e[k]).forEach(s => ex.push({ tag: k, s })));
      if (ex.length) c.examples = ex;
      if (Object.keys(c).length) content[fid] = c;
    });
    if (!cluster.members.length) warn(cw, `cluster "${id}" has no ${noun}s yet`);
  }

  /* ---- resolve words → ids (aliases count too) ---- */
  const ids = new Set(feelings.map(f => f.id)), alias = {};
  feelings.forEach(f => (f.aliases || []).forEach(a => {
    const s = slug(a);
    if (ids.has(s)) warn(where[f.id], `alias "${a}" on "${f.word}" is already its own ${noun}`);
    else alias[s] = alias[s] || f.id;
  }));
  const resolve = (w, fw, why) => { const s = slug(w); if (ids.has(s)) return s; if (alias[s]) return alias[s]; warn(fw, `${why} "${w}" isn't a ${noun} yet`); return null; };
  const cids = new Set(clusters.map(c => c.id));
  const byCluster = Object.fromEntries(clusters.map(c => [c.id, c]));
  const byId = Object.fromEntries(feelings.map(f => [f.id, f]));

  /* ---- thesaurus: each synonym lives under exactly one feeling, so a word always lands in one place ---- */
  const synOwner = {};
  let nSyn = 0, nDeep = 0;
  for (const { f, syn, fw } of rawSyn) {
    const out = [];
    for (const s of syn) {
      const id = slug(s.word), on = `synonym "${s.word}" on "${f.word}"`;
      if (!id) { warn(fw, `${on} has no letters`); continue; }
      if (id === f.id) { warn(fw, `${on} is the word itself`); continue; }
      if (ids.has(id)) { warn(fw, `${on} is already its own ${noun} — link it with see: instead`); continue; }
      if (alias[id] && alias[id] !== f.id) { warn(fw, `${on} is already an alias of "${byId[alias[id]].word}"`); continue; }
      if (synOwner[id]) { warn(fw, synOwner[id] === f ? `${on} is listed twice` : `${on} is already a synonym of "${synOwner[id].word}" — keep it where it fits best`); continue; }
      synOwner[id] = f;
      out.push({ id, ...s });
      if (s.deep) nDeep++; else nSyn++;
    }
    if (out.length) f.syn = out;
  }

  for (const { f, e, fw } of raw) {
    const links = {};
    deck.links.forEach(k => {
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

  /* ---- every family needs exactly one core word (the home bubbles) ---- */
  families.forEach(F => {
    const cores = feelings.filter(f => f.core && Object.keys(f.mix)[0] === F.id);
    if (cores.length !== 1) fail(relOf(cdir), `family "${F.id}" needs exactly one ${noun} with core: true (found ${cores.length})`);
  });

  if (errors.length) throw new FeelingsError(errors);
  const examples = Object.values(content).reduce((n, c) => n + (c.examples || []).length, 0);
  const aliasOnly = Object.keys(alias).filter(a => !synOwner[a]).length;
  const stats = { families: families.length, clusters: clusters.length, feelings: feelings.length, synonyms: nSyn, deep: nDeep,
    words: feelings.length + aliasOnly + nSyn + nDeep, examples };
  if (SIDES.length) stats.sides = Object.fromEntries(SIDES.map(s => [s, feelings.filter(f => f.side === s).length]));
  const { id, name, tags, sides } = deck;
  return { data: { deck: { id, name, noun, tags, fields: FIELDK, sides }, families, clusters, feelings }, content, warnings, stats, files, deck };
}
