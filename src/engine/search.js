/* Feelings wheel — search: a thesaurus lookup across every deck. Spell a word, half-spell it, misspell
   it ("lonley"), or describe it ("too much", "makes me laugh"); a word you spell brings its synonyms. The field grows out of the
   magnifier in the top bar and the results sit on frosted glass beneath it, this deck's words first.
   Tap a word to fly to it (switching decks if it lives in the other one), or pin it from the list.
   Timing: --fw-motion-search-open / -close. The example phrases: FW.UIS[deck].search (decks.js). */
(function () {
const FW = window.FW;
const esc = s => FW.esc(s);
const ICON = '<svg class="sico" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>';
const CAP = 40, CAP_OTHER = 12;

/* ---------- folding: accents, case, apostrophes and punctuation, so “Can’t” finds “cant” ---------- */
const QUOTE = /['’‘`´]/;
const norm = s => String(s || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/['’‘`´]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/* the same fold, remembering where each letter came from, so a match can be marked in the original */
function fold(raw) {
  let n = '', sp = true; const at = [];
  for (let i = 0; i < raw.length; i++) {
    if (QUOTE.test(raw[i])) continue;
    for (const c of raw[i].normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()) {
      if (/[\p{L}\p{N}]/u.test(c)) { n += c; at.push(i); sp = false; }
      else if (!sp) { n += ' '; at.push(i); sp = true; }
    }
  }
  if (sp && n) { n = n.slice(0, -1); at.pop(); }
  return { n, at };
}

/* describing: skip the little words and trim word endings, so "laughing" finds "laughs" and
   "worried" finds "worry". A stem is always the front of the word, so it only ever widens a match. */
const STOP = new Set(('a an the and or but nor so if than then that this these those there here ' +
  'i im ive id me my mine myself you youre your yours yourself u ur we our us they them their theyre ' +
  'he him his she her hers it its is are am was were be been being do does did dont doesnt didnt ' +
  'shes hes thats whats theres heres youve weve theyve ' +
  'have has had to of in on at by for with from into onto about as like just really very quite ' +
  'more most some any feel feels feeling felt get gets got make makes made thing things way kinda sorta ' +
  'someone something somebody when what who how why always can could would should will ever').split(' '));
/* words that shape a phrase ("can't stop", "left out", "too much") but say little alone: they
   count for half, and can't carry a match by themselves unless they're all you typed */
const WEAK = new Set(('cant cannot couldnt wont wouldnt shouldnt isnt arent wasnt werent not no never nothing ' +
  'out up down off over away back around still even again want wanted need needed bit little lot too much ' +
  'all every everything anything everyone anyone nobody one').split(' '));
/* "kind of sad", "sort of lost": filler there, but "kind" is a word of its own everywhere else */
const filler = (t, i, toks) => (t === 'kind' || t === 'sort') && toks[i + 1] === 'of';
/* the words that only frame a feeling ("I'm feeling down", "she's so funny"): drop just these and
   what's left is the word itself — unlike "has my back", where "back" alone means something else */
const FRAME = new Set(('i im am is are was were be being feel feels feeling felt so very really quite just pretty ' +
  'totally kinda sorta kind sort of a an the it its me makes make made get gets got she shes he hes they theyre you youre u ur').split(' '));
/* a word inside a longer one counts when it's the end of it ("killjoy"), comes after a prefix
   ("overjoyed", "unhappy", "beloved"), or is long enough to mean it ("wholehearted") */
const PRE = /^(?:un|dis|mis|in|im|ir|il|non|en|em|be|re|de|over|under|out|self|super|hyper|anti|ill|well)$/;
const SUF = ['ness', 'ment', 'ings', 'ing', 'ies', 'ied', 'ers', 'ed', 'es', 'er', 'ly', 's', 'y', 'd'];
const stem = w => {
  if (w.length < 5) return w;
  let s = w;
  for (const x of SUF) {
    if (!s.endsWith(x) || s.length - x.length < 4 || (x === 's' && /(ss|us|is)$/.test(s)) || (x === 'd' && !s.endsWith('ed'))) continue;
    s = s.slice(0, -x.length); break;
  }
  return s.length > 4 && /[ie]$/.test(s) ? s.slice(0, -1) : s;
};
function parse(raw) {
  const n = norm(raw), toks = n ? n.split(' ') : [], seen = new Map();
  toks.forEach((t, i) => {
    if (t.length < 2 || STOP.has(t) || filler(t, i, toks)) return;
    const s = stem(t), weak = WEAK.has(t) || WEAK.has(s);
    if (!seen.has(s) || !weak) seen.set(s, weak);
  });
  /* all little words ("always there"): use them anyway, at half weight */
  if (!seen.size) toks.forEach(t => t.length >= 2 && seen.set(stem(t), true));
  const terms = [...seen.keys()].slice(0, 8);
  /* "feeling down", "so tired", "I'm anxious": the words without the little ones, to match names too */
  const kept = toks.filter((t, i) => !STOP.has(t) && !filler(t, i, toks)), core = kept.join(' ');
  const usable = kept.some(t => !WEAK.has(t) && !WEAK.has(stem(t))) || toks.every(t => kept.includes(t) || FRAME.has(t));
  return { raw: String(raw || ''), n, c: n.replace(/ /g, ''), terms, weak: terms.map(t => seen.get(t)), phrase: toks.length > 1 ? ' ' + n : '',
    alt: core && core !== n && usable ? { n: core, c: core.replace(/ /g, '') } : null };
}

/* typo distance (optimal string alignment: swaps count as one), giving up past k */
function osa(a, b, k) {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > k) return k + 1;
  if (!la || !lb) return Math.max(la, lb);
  let p2 = new Array(lb + 1), p1 = new Array(lb + 1), c = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) p1[j] = j;
  for (let i = 1; i <= la; i++) {
    c[0] = i; let lo = i;
    for (let j = 1; j <= lb; j++) {
      let v = Math.min(p1[j] + 1, c[j - 1] + 1, p1[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
      c[j] = v; if (v < lo) lo = v;
    }
    if (lo > k) return k + 1;
    const t = p2; p2 = p1; p1 = c; c = t;
  }
  return p1[lb];
}
/* a typo while still typing a longer word: "melanh" → melancholy */
const typoPrefix = (q, c) => Math.min(osa(q, c.slice(0, q.length), 1), osa(q, c.slice(0, q.length + 1), 1), osa(q, c.slice(0, q.length - 1), 1));

/* ---------- the index: every word (heads and their synonyms), its aliases, and the text that describes it ---------- */
const idx = {};
const deckIds = () => Object.keys(window.FW_DECKS || {}).filter(d => FW.UIS && FW.UIS[d]);
function index(d) {
  if (idx[d]) return idx[d];
  const S = FW.getDeck(d), UI = FW.UIS[d], list = [];
  const text = (k, v, pre = '', post = '') => ({ k, v, pre, post, n: ' ' + norm(v) + ' ' });
  const add = f => {
    const n = norm(f.word);
    const al = (f.aliases || []).map(a => { const x = norm(a); return { a, n: x, c: x.replace(/ /g, '') }; }).filter(a => a.n);
    /* k: 0 what it means · 1 the deck's notes (in your body / you see it in) · 2 things people say */
    const tx = f.def ? [text(0, f.def)] : [];
    if (!f.head) {
      const c = S.content[f.id] || {};
      (UI.fields || []).forEach(fd => [].concat(c[fd.key] || []).forEach(v => {
        if (typeof v !== 'string' || !v.trim()) return;
        tx.push(fd.quote ? text(2, v, '\u201c', '\u201d') : text(1, v, fd.lead || '', fd.dot && !/[.!?\u2026]$/.test(v.trim()) ? '.' : ''));
      }));
      (c.examples || []).forEach(x => x && typeof x.s === 'string' && tx.push(text(2, x.s, '\u201c', '\u201d')));
    }
    list.push({ f, d, id: f.id, n, c: n.replace(/ /g, ''), al, tx, wn: ' ' + [n, ...al.map(a => a.n)].join(' ') + ' ' });
  };
  S.list.forEach(add);
  S.syns.forEach(add);
  /* each head with its synonyms, the way the orbit groups them */
  const fam = new Map();
  list.forEach(e => { const h = e.f.head || e.id; if (!fam.has(h)) fam.set(h, []); fam.get(h).push(e); });
  return (idx[d] = { d, list, fam });
}

/* ---------- matching ----------
   tiers: 0 the word · 1 an alias · 2/3 starts with (or another form of it: love → loving) · 4/5 a later word starts with · 6/7 contains ·
   8 a typo away, or the family of the word you spelled (its head and the rest of its synonyms) ·
   9 described that way (enough of the rarer words in the query, wherever they appear) ·
   10 a typo away when something is spelled that way too */
function inside(n, c, q) {
  if (q.c.length < 3) return false;
  if (q.c.length >= 6) return c.includes(q.c);
  for (let i = n.indexOf(q.n, 1); i > 0; i = n.indexOf(q.n, i + 1)) {
    const j = i + q.n.length;
    if (j === n.length || n[j] === ' ' || PRE.test(n.slice(n.lastIndexOf(' ', i) + 1, i))) return true;
  }
  return false;
}
const tier = (n, c, q) => n === q.n || c === q.c ? 0 : n.startsWith(q.n) || c.startsWith(q.c) ? 1
  : (' ' + n).includes(' ' + q.n) ? 2 : inside(n, c, q) ? 3 : 9;
/* the phrase without its little words ("feeling down" → down) only matches at the start of a word */
const tierAlt = (n, c, q) => { const r = tier(n, c, q); return r <= 2 ? r : 9; };
/* the other forms of a word: the e that drops ("love" → loving, lovable; "nerve" → nervous) and
   the y that turns to i ("beauty" → beautiful, "happy" → happiness) — at the start of a word, like a prefix */
const DROP = /^(?:ing|ab(?:le|ly)|ations?|ative|ions?|ive|ous|ity|y)/, TURN = /^(?:ness|ly|er|est|ed|es|ful|ous|some|ment|able|ty)/;
function morph(c) {
  if (c.length < 4) return null;
  /* -ious only after a c: grace → gracious, but cure ≠ curious */
  if (/[^aeiou]e$/.test(c)) { const s = c.slice(0, -1); return { s, ok: r => DROP.test(r) || (/c$/.test(s) && /^ious/.test(r)) }; }
  if (/[^aeiou]y$/.test(c)) return { s: c.slice(0, -1) + 'i', ok: r => TURN.test(r) };
  return null;
}
/* a word built whole on the one you typed is another form of it too — grace → graceful, hope → hopeful,
   charm → charming, wit → witty — but not its opposite (hopeless), nor a false friend (rest ≠ restive) */
const SUFX = /^(?:ful|ing|ed|d|ous|ly|y|ness|er|ive|ent|ant|able|ible|al|ical|ic|some|ment)$/;
const FALSE = new Set(['restive', 'awful', 'manic', 'bashful', 'hearty', 'smarting', 'touchy', 'petty', 'catty']);
function derived(c, q) {
  if (q.length < 3 || c.length <= q.length || !c.startsWith(q) || FALSE.has(c)) return false;
  const r = c.slice(q.length), z = q[q.length - 1];
  if (r[0] === z && !/[aeiouy]/.test(z) && /^(?:y|er|est|ing|ed)$/.test(r.slice(1))) return true;
  return SUFX.test(r) && (r !== 'd' || z === 'e');
}
function tierForm(n, m) {
  for (let i = n.indexOf(m.s); i !== -1; i = n.indexOf(m.s, i + 1)) {
    if (i > 0 && n[i - 1] !== ' ') continue;
    if (m.ok(n.slice(i + m.s.length).split(' ')[0])) return i ? 2 : 1;
  }
  return 9;
}
function search(d, q) {
  const { list, fam } = index(d), out = [], rest = [], near = [];
  if (!q.c) return out;
  const fq = q.alt || q, f0 = fq.c[0], fz = fq.c.length >= 4 && fq.c.length <= 32, k = fq.c.length >= 7 ? 2 : 1;
  const M = fq.n.includes(' ') ? null : morph(fq.c);
  for (const e of list) {
    let t = tier(e.n, e.c, q) * 2, via = null, alt = false, mq = null;
    for (const a of e.al) { const ta = tier(a.n, a.c, q) * 2 + 1; if (ta < t) { t = ta; via = a; } }
    if (q.alt && t > 7) {
      const tw = tierAlt(e.n, e.c, q.alt) * 2; if (tw < t) { t = tw; alt = true; }
      for (const a of e.al) { const ta = tierAlt(a.n, a.c, q.alt) * 2 + 1; if (ta < t) { t = ta; via = a; alt = true; } }
    }
    if (M && t > 3) {
      const tf = tierForm(e.n, M) * 2; if (tf < t) { t = tf; via = null; mq = M.s; }
      for (const a of e.al) { const ta = tierForm(a.n, M) * 2 + 1; if (ta < t) { t = ta; via = a; mq = M.s; } }
    }
    if (t <= 7) out.push({ e, t, x: 0, via, alt, mq }); else near.push(e);
  }
  /* typos keep their first letter ("lonley" → lonely, "melanh" → melancholy), and step aside for real
     spellings: none at all when the word itself was found, after the described ones when part of it was.
     Finding the word itself — or another form of it ("love" → loving), or the one you surely meant —
     brings its family along, in the orbit's order */
  const exact = out.some(h => h.t <= 1), tt = out.length ? 10 : 8, typo = new Map(), kin = new Map();
  if (fz && !exact) for (const e of near) {
    let xx = e.c[0] === f0 ? osa(fq.c, e.c, k) : k + 1, va = null;
    for (const a of e.al) if (a.c[0] === f0) { const xa = osa(fq.c, a.c, k); if (xa < xx) { xx = xa; va = a; } }
    if (xx <= k) typo.set(e, { x: xx, via: va });
    else if (fq.c.length >= 5 && e.c[0] === f0 && e.c.length > fq.c.length + 1 && typoPrefix(fq.c, e.c) <= 1) typo.set(e, { x: 1.5, via: null });
  }
  const formed = exact ? [] : out.filter(h => { const w = h.via || h.e; return h.t <= 3 && !w.n.includes(' ') && (h.mq || derived(w.c, fq.c)); }).map(h => h.e);
  const found = exact || formed.length > 0;
  const sure = exact ? out.filter(h => h.t <= 1).map(h => h.e) : formed.length ? formed : [...typo].filter(([, v]) => v.x <= 1).map(([e]) => e);
  if (found || sure.length <= 2) sure.forEach(s => (fam.get(s.f.head || s.id) || []).forEach((e, i) => kin.has(e) || kin.set(e, e.f.head ? 5.5 + i / 1e3 : 5)));
  out.forEach(h => kin.delete(h.e)); typo.forEach((v, e) => kin.delete(e));
  for (const e of near) {
    const ty = typo.get(e);
    if (ty) out.push({ e, t: tt, x: ty.x, via: ty.via, ty: true });
    else if (kin.has(e)) out.push({ e, t: found ? 8 : tt, x: kin.get(e), via: null, ty: !found });
    else rest.push(e);
  }
  const T = q.terms;
  if (T.length && q.c.length >= 3) {
    /* the little words only as whole words: "up" isn't the start of "uproarious" */
    const P = T.map((t, j) => ' ' + t + (q.weak[j] && t.length <= 4 ? ' ' : ''));
    const has = s => { let m = 0; for (let j = 0; j < T.length; j++) if (s.includes(P[j])) m |= 1 << j; return m; };
    const df = T.map(() => 0), M = new Map();
    for (const e of list) {
      const wm = has(e.wn), tm = e.tx.map(x => has(x.n)), all = tm.reduce((a, b) => a | b, wm);
      if (!all) continue;
      M.set(e, { wm, tm, all });
      for (let j = 0; j < T.length; j++) if (all & 1 << j) df[j]++;
    }
    /* rarer words count for more (the little phrase words for half); keep a word once it covers most
       of the query's weight, and at least one of its real words when it has any — or, when that
       leaves only a few, once it covers nearly half */
    const idf = df.map((v, j) => v ? Math.log(1 + list.length / v) * (q.weak[j] ? 0.5 : 1) : 0), tot = idf.reduce((a, b) => a + b, 0);
    const strong = T.reduce((m, t, j) => q.weak[j] ? m : m | 1 << j, 0);
    const sum = m => { let s = 0; for (let j = 0; j < T.length; j++) if (m & 1 << j) s += idf[j]; return s; };
    /* only little words, and not just framing a word ("has my back", "always there"): the phrase itself */
    const need = !strong && q.phrase && !q.alt;
    const D = [];
    if (tot > 0) for (const e of rest) {
      const r = M.get(e); if (!r || (strong && !(r.all & strong))) continue;
      const base = sum(r.all); if (base < tot * 0.45 - 1e-9) continue;
      let best = -1, bs = -Infinity;
      r.tm.forEach((m, i) => {
        if (!m) return;
        const s = sum(m) + (q.phrase && e.tx[i].n.includes(q.phrase) ? tot : 0) - e.tx[i].k * 0.01;
        if (s > bs) { bs = s; best = i; }
      });
      const ph = best >= 0 && q.phrase && e.tx[best].n.includes(q.phrase);
      if (need && !ph) continue;
      /* its own name counts extra — unless all you typed were little words ("has my back" ≠ backhanded) */
      D.push({ e, t: 9, x: 0, base, sc: base + (strong ? sum(r.wm) * 0.5 : 0) + (ph ? tot * 0.5 : 0), snip: best, k: best >= 0 ? e.tx[best].k : 3 });
    }
    const most = D.filter(h => h.base >= tot * 0.6 - 1e-9);
    /* ties go to the words living where the found ones do: "love" → the heart words before "exhausting" */
    const vote = new Map(), homes = f => [f.cluster, ...(f.also || [])];
    const cast = (f, w) => homes(f).forEach((c, i) => c && vote.set(c, (vote.get(c) || 0) + (i ? w / 2 : w)));
    out.forEach(h => h.t <= 8 && cast(h.e.f, 2));
    D.forEach(h => h.k === 0 && cast(h.e.f, 1));
    D.forEach(h => { h.af = homes(h.e.f).reduce((s, c, i) => s + (vote.get(c) || 0) * (i ? 0.5 : 1), 0); });
    out.push(...(most.length >= 6 ? most : D));
  }
  const headFirst = (a, b) => (a.e.f.head ? 1 : 0) - (b.e.f.head ? 1 : 0);
  return out.sort((a, b) => a.t - b.t
    || (a.t === 9 ? (b.sc - a.sc) || (a.k - b.k) || (b.af - a.af) : (a.x - b.x) || (a.e.n.length - b.e.n.length))
    || headFirst(a, b) || a.e.n.localeCompare(b.e.n));
}

/* ---------- marking matches in the original text ---------- */
function hl(raw, terms, mode) {
  raw = String(raw || '');
  const { n, at } = fold(raw), R = [];
  terms.forEach(t => {
    if (!t) return;
    for (let i = n.indexOf(t); i !== -1; i = n.indexOf(t, i + 1)) {
      if (mode !== 'any' && i > 0 && n[i - 1] !== ' ') continue;
      let j = i + t.length;
      if (mode === 'word') while (j < n.length && n[j] !== ' ') j++;
      R.push([at[i], at[j - 1] + 1]);
      if (mode !== 'word') break;
    }
  });
  if (!R.length) return { html: esc(raw), first: -1 };
  R.sort((a, b) => a[0] - b[0]);
  const M = [R[0].slice()];
  R.slice(1).forEach(([s, e]) => { const L = M[M.length - 1]; if (s <= L[1]) L[1] = Math.max(L[1], e); else M.push([s, e]); });
  let html = '', p = 0;
  M.forEach(([s, e]) => { html += esc(raw.slice(p, s)) + '<mark>' + esc(raw.slice(s, e)) + '</mark>'; p = e; });
  return { html: html + esc(raw.slice(p)), first: M[0][0] };
}
/* a describing match shows the line it came from, starting near the match when it's far in */
function snippet(x, terms) {
  let v = x.v, cut = '', r = hl(v, terms, 'word');
  if (r.first > 64) {
    const s = v.lastIndexOf(' ', r.first - 22) + 1;
    if (s > 0) { v = v.slice(s); cut = '\u2026'; r = hl(v, terms, 'word'); }
  }
  return esc(x.pre) + cut + r.html + esc(x.post);
}

/* ---------- drawing ---------- */
let open = false, ready = false, wired = false, raf = 0, sel = -1, rows = [], q = parse('');
let btn, theme, field, input, clear, done, find, body, strange = [], strangeDeck = '';
const more = new Set();

const groupHTML = (d, n) => {
  const c = FW.deckColors(d);
  return `<div class="sgroup"><b class="mdot" style="background:conic-gradient(${c.join(',')},${c[0]})"></b>${esc(FW.UIS[d].tab)}<em>${n} word${n === 1 ? '' : 's'}</em></div>`;
};
function rowHTML(h, i, mine) {
  const { e, t } = h, f = e.f, S = FW.getDeck(e.d), UI = FW.UIS[e.d], hd = f.head && S.byId[f.head];
  const where = hd ? `\u2248 ${hd.word}` + (f.lang ? ` · ${f.lang}` : f.deep ? ' · uncommon' : '')
    : [f.cluster, ...(f.also || [])].map(c => S.cluster[c] && S.cluster[c].name).filter(Boolean).join(' · ') || (S.fam[f.dom] || {}).name || '';
  const eye = where + (UI.sides && UI.sides[f.side] ? ` · ${UI.sides[f.side]}` : '');
  const mode = t >= 6 ? 'any' : 'start', mq = [h.mq || (h.alt ? q.alt.n : q.n)];
  const word = t <= 6 && !h.via ? hl(f.word, mq, mode).html : esc(f.word);
  const aka = h.via ? `<span class="sa">also \u201c${t <= 7 ? hl(h.via.a, mq, mode).html : esc(h.via.a)}\u201d</span>`
    : f.sounds ? `<span class="sa">${esc(f.sounds)}</span>` : '';
  const def = t === 9 && h.snip >= 0 ? snippet(e.tx[h.snip], q.terms) : esc(f.def || '');
  const on = mine && FW.isPinned(f.id);
  return `<div class="srow" role="option" data-i="${i}" style="--c:${f.avg}"><span class="sdot" style="background:${FW.fillCSS(f)}"></span>` +
    `<div class="sb">${eye ? `<div class="seye">${esc(eye)}</div>` : ''}<div class="sw">${word}${aka}</div>` +
    (def ? `<div class="sdef">${def}</div>` : '') + '</div>' +
    (mine ? `<button class="spin${on ? ' on' : ''}" aria-label="${on ? 'Unpin' : 'Pin'} ${esc(f.word)}">${on ? '\u2713' : '+'}</button>` : '') + '</div>';
}
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
/* nothing typed: a handful of strange words to wander into, and a few ways to describe it */
function emptyHTML(fresh) {
  const d = FW.deck.id, sx = (FW.UIS[d] || {}).search || {};
  if (fresh || strangeDeck !== d || !strange.length) { strange = shuffle(FW.getDeck(d).syns.filter(f => f.deep)).slice(0, 9); strangeDeck = d; }
  return `<div class="ssec"><div class="slabel">Try a strange word<button class="sshuf" data-act="shuffle" aria-label="More strange words">\u21bb</button></div>` +
    `<div class="tw">${strange.map(f => `<button class="tchip deep" data-go="${esc(f.id)}"><i style="background:${FW.fillCSS(f)}"></i>${esc(f.word)}</button>`).join('')}</div></div>` +
    ((sx.try || []).length ? `<div class="ssec"><div class="slabel">${esc(sx.describe || 'Or describe it')}</div>` +
      `<div class="tw">${sx.try.map(t => `<button class="tchip" data-q="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>` : '');
}
function draw() {
  sel = -1; rows = [];
  if (!q.c) { body.innerHTML = emptyHTML(); return; }
  const here = FW.deck.id, R = [here, ...deckIds().filter(d => d !== here)].map(d => ({ d, hits: search(d, q) }));
  const best = r => r.hits.length ? r.hits[0].t : 99;
  /* spelled out in one deck ("lonely", or the start of "peaceful"): no guessing at typos in the other ("lovely", "perceptive") */
  if (R.some(r => best(r) <= 3)) R.forEach(r => { if (best(r) > 3) r.hits = r.hits.filter(h => !h.ty); });
  /* the deck where the word lives comes first — the word itself ("funny" while describing a feeling), then
     its start or another form of it ("peace" → peaceful) — and otherwise the deck you're in */
  const rank = r => best(r) <= 1 ? 0 : best(r) <= 3 ? 1 : 2;
  R.sort((a, b) => rank(a) - rank(b));
  let html = '';
  R.forEach((r, gi) => {
    if (!r.hits.length) return;
    const cap = more.has(r.d) ? Infinity : gi === 0 || !R[0].hits.length ? CAP : CAP_OTHER;
    html += groupHTML(r.d, r.hits.length);
    r.hits.slice(0, cap).forEach(h => { html += rowHTML(h, rows.length, r.d === here); rows.push(h); });
    if (r.hits.length > cap) html += `<button class="smore" data-more="${r.d}">Show all ${r.hits.length}</button>`;
  });
  body.innerHTML = html || `<div class="snone">No words for \u201c${esc(q.raw.trim())}\u201d yet</div>` + emptyHTML();
}
function intro() {
  const m = FW.tok.motion('search-open'), els = [...body.children].slice(0, 14);
  if (els.length) gsap.fromTo(els, { y: m.rise ?? 10, opacity: 0 }, { y: 0, opacity: 1, duration: FW.dur(m.dur), ease: m.ease,
    stagger: FW.reduce ? 0 : (m.stagger ?? 0.016), overwrite: true, clearProps: 'transform,opacity' });
}
function update() { raf = 0; q = parse(input.value); more.clear(); body.scrollTop = 0; draw(); }
function changed() {
  field.classList.toggle('has', !!input.value);
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(update);
}
const flush = () => { if (raf) { cancelAnimationFrame(raf); update(); } };

/* the word count in the placeholder: every distinct word and alias, across the decks */
function ensure() {
  if (ready || !input) return;
  ready = true;
  const all = new Set();
  deckIds().forEach(d => index(d).list.forEach(e => { all.add(e.n); e.al.forEach(a => all.add(a.n)); }));
  input.placeholder = `Search ${all.size.toLocaleString()} words`;
}

/* ---------- open / close: the field grows out of the magnifier and shrinks back into it ---------- */
function geometry() {
  const w = FW.els.wheel, L = w.offsetLeft + w.offsetWidth + 10;
  return { L, W: Math.max(140, done.offsetLeft - 8 - L), bx: btn.offsetLeft - 3 };
}
function show() {
  if (open || !field) return;
  open = true;
  FW.els.frame.classList.add('searching');     // visible before focus(), or iOS won't raise the keyboard
  find.setAttribute('aria-hidden', 'false');
  find.style.pointerEvents = '';
  const g = geometry(), m = FW.tok.motion('search-open'), dur = FW.dur(m.dur);
  gsap.killTweensOf([field, done, find, btn, theme, FW.els.dockLabel]);
  if (!gsap.getProperty(field, 'opacity')) gsap.set(field, { left: g.bx, width: 42 });
  input.focus({ preventScroll: true });
  input.select();
  ensure();
  q = parse(input.value);
  field.classList.toggle('has', !!input.value);
  draw();
  gsap.to(field, { left: g.L, width: g.W, opacity: 1, duration: dur, ease: m.ease });
  gsap.fromTo(done, { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: dur, ease: m.ease, delay: dur * 0.15 });
  gsap.to(find, { opacity: 1, duration: dur, ease: m.ease });
  gsap.to([btn, theme], { autoAlpha: 0, duration: dur * 0.4 });
  gsap.to(FW.els.dockLabel, { opacity: 0, duration: dur * 0.4 });
  intro();
}
function hide() {
  if (!open) return;
  open = false;
  input.blur();
  find.setAttribute('aria-hidden', 'true');
  find.style.pointerEvents = 'none';           // the bubbles below are live again while it fades
  const g = geometry(), m = FW.tok.motion('search-close'), dur = FW.dur(m.dur);
  gsap.to(field, { left: g.bx, width: 42, opacity: 0, duration: dur, ease: m.ease, overwrite: true });
  gsap.to(done, { opacity: 0, x: 10, duration: dur * 0.6, ease: m.ease, overwrite: true });
  gsap.to(find, { opacity: 0, duration: dur, ease: m.ease, overwrite: true, onComplete: () => { if (!open) FW.els.frame.classList.remove('searching'); } });
  gsap.to([btn, theme], { autoAlpha: 1, duration: dur, delay: dur * 0.5, overwrite: true });
  gsap.to(FW.els.dockLabel, { opacity: 1, duration: dur, delay: dur * 0.3, overwrite: true });
}
FW.openSearch = show;
FW.closeSearch = hide;
/* a picked word: the overlay fades while the bubbles fly to it (main.js switches decks if needed) */
function pick(d, id) {
  hide();
  FW.emit('find', { deck: d, id });
}

/* ---------- input ---------- */
function step(dir) {
  sel = sel < 0 ? (dir > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, sel + dir));
  body.querySelectorAll('.srow.sel').forEach(r => r.classList.remove('sel'));
  const r = body.querySelector(`.srow[data-i="${sel}"]`);
  if (r) { r.classList.add('sel'); r.scrollIntoView({ block: 'nearest' }); }
}
function onKey(e) {
  if (e.isComposing) return;
  if (e.key === 'Escape') { e.preventDefault(); hide(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { flush(); if (!rows.length) return; e.preventDefault(); step(e.key === 'ArrowDown' ? 1 : -1); }
  else if (e.key === 'Enter') {
    e.preventDefault(); flush();
    const h = rows[Math.max(0, sel)];
    if (h) pick(h.e.d, h.e.id); else input.blur();
  }
}
function onBody(e) {
  const t = e.target, pin = t.closest('.spin'), row = t.closest('.srow');
  if (pin && row) {
    const h = rows[+row.dataset.i]; if (!h) return;
    if (FW.isPinned(h.e.id)) FW.unpin(h.e.id); else FW.pin(h.e.id, row.querySelector('.sdot'));
    return;
  }
  if (row) { const h = rows[+row.dataset.i]; if (h) pick(h.e.d, h.e.id); return; }
  const go = t.closest('[data-go]');
  if (go) return pick(FW.deck.id, go.dataset.go);
  const dq = t.closest('[data-q]');
  if (dq) { input.value = dq.dataset.q; field.classList.add('has'); flush(); update(); intro(); return; }
  const mo = t.closest('[data-more]');
  if (mo) { more.add(mo.dataset.more); const top = body.scrollTop; draw(); body.scrollTop = top; return; }
  if (t.closest('[data-act=shuffle]')) { body.innerHTML = emptyHTML(true); intro(); }
}
const drawerOpen = () => FW.els.drawer && getComputedStyle(FW.els.drawer).visibility === 'visible';
function onDocKey(e) {
  if (e.defaultPrevented || e.isComposing || !field) return;
  if (open && e.key === 'Escape') { hide(); return; }
  const a = document.activeElement;
  if (!open && e.key === '/' && !e.metaKey && !e.ctrlKey && !(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) && !drawerOpen()) {
    e.preventDefault(); show();
  }
}
/* keep the last results clear of the on-screen keyboard */
const vv = window.visualViewport;
function onViewport() {
  if (!vv || !body) return;
  const h = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  body.style.paddingBottom = h > 40 ? `${Math.round(h) + 28}px` : '';
}
function onResize() {
  if (!open || !field) return;
  const g = geometry();
  gsap.set(field, { left: g.L, width: g.W });
}
const idle = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 3000 }) : f => setTimeout(f, 1500);

FW.initSearch = () => {
  const { frame, topbar } = FW.els;
  theme = topbar.querySelector('#themeBtn');
  const tools = document.createElement('div');
  tools.className = 'tools';
  btn = document.createElement('button');
  btn.className = 'iconbtn'; btn.id = 'searchBtn'; btn.title = 'Search'; btn.setAttribute('aria-label', 'Search words');
  btn.innerHTML = ICON;
  theme.before(tools);
  tools.append(btn, theme);
  field = document.createElement('div');
  field.className = 'sfield'; field.id = 'sfield';
  field.innerHTML = ICON + '<input id="sinput" type="search" enterkeyhint="go" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Search words" aria-label="Search words" aria-controls="fbody">' +
    '<button class="sclear" id="sclear" aria-label="Clear">\u2715</button>';
  done = document.createElement('button');
  done.className = 'sdone'; done.id = 'sdone'; done.textContent = 'Done';
  topbar.append(field, done);
  /* under the top bar (same layer, earlier in the page), so the wheel stays in view for pins to land in */
  find = document.createElement('div');
  find.className = 'find'; find.id = 'find'; find.setAttribute('aria-hidden', 'true');
  find.innerHTML = '<div class="fbody" id="fbody" role="listbox" aria-label="Words"></div>';
  frame.insertBefore(find, topbar);
  input = field.querySelector('input'); clear = field.querySelector('.sclear'); body = find.querySelector('.fbody');
  Object.assign(FW.els, { searchBtn: btn, sfield: field, sinput: input, sdone: done, find, fbody: body });
  open = false; ready = false; rows = []; sel = -1;

  btn.addEventListener('click', show);
  done.addEventListener('click', hide);
  clear.addEventListener('pointerdown', e => e.preventDefault());   // keep the keyboard up
  clear.addEventListener('click', () => { input.value = ''; field.classList.remove('has'); flush(); update(); input.focus({ preventScroll: true }); });
  input.addEventListener('input', changed);
  input.addEventListener('keydown', onKey);
  body.addEventListener('click', onBody);
  body.addEventListener('touchstart', () => {}, { passive: true });   // lets :active show on iOS
  body.addEventListener('touchmove', () => { if (document.activeElement === input) input.blur(); }, { passive: true });
  FW.els.dock.addEventListener('pointerdown', () => { if (open) input.blur(); });   // opening my wheel puts the keyboard away
  idle(ensure);
  if (!wired) {
    wired = true;
    document.addEventListener('keydown', onDocKey);
    if (vv) vv.addEventListener('resize', onViewport);
    addEventListener('resize', onResize);
  }
};

FW.on('pins', () => {
  if (!body) return;
  body.querySelectorAll('.srow .spin').forEach(b => {
    const h = rows[+b.closest('.srow').dataset.i]; if (!h) return;
    const on = FW.isPinned(h.e.id);
    b.classList.toggle('on', on);
    b.textContent = on ? '\u2713' : '+';
    b.setAttribute('aria-label', `${on ? 'Unpin' : 'Pin'} ${h.e.f.word}`);
  });
});
FW.on('deck', () => { if (open) draw(); });
/* going somewhere from elsewhere (the drawer's word chips) puts the search away */
FW.on('explore', () => { if (open) hide(); });

/* for poking at results from the console: FW.search('cant sleep') */
FW.search = (text, d) => search(d || FW.deck.id, parse(text)).map(h => ({ word: h.e.f.word, id: h.e.id, tier: h.t, via: h.via && h.via.a,
  snip: h.t === 9 && h.snip >= 0 ? h.e.tx[h.snip].v : undefined }));
})();
