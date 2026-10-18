/* Feelings wheel — core engine (window.FW). Motion + colours come from the design tokens (FW.tok). */
(function () {
const FW = window.FW = window.FW || {};
const D = window.FEELINGS_DATA;
const T = FW.tok;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
FW.reduce = reduce;
FW.dur = s => reduce ? 0.01 : s;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
FW.esc = esc;

/* ---------- colour ---------- */
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mixHex = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); };
const alpha = (h, a) => { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; };
const lum = h => { const c = hex2rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
FW.ink = { dark: '#14131A', light: '#FFFFFF' };
const inkFor = h => lum(h) > 0.36 ? FW.ink.dark : FW.ink.light;
FW.color = { hex2rgb, rgb2hex, mixHex, alpha, lum, inkFor };
let cctx = null;
const toHex = c => {
  if (!c) return null;
  cctx = cctx || document.createElement('canvas').getContext('2d');
  cctx.fillStyle = '#000000'; cctx.fillStyle = c;
  return /^#[0-9a-f]{6}$/i.test(cctx.fillStyle) ? cctx.fillStyle.toUpperCase() : null;
};
FW.color.toHex = toHex;

/* ---------- data prep ---------- */
FW.fams = D.families;
FW.fam = {};
D.families.forEach(F => { F.rad = F.angle * Math.PI / 180; F.ink = inkFor(F.color); FW.fam[F.id] = F; });
FW.list = D.feelings;
FW.byId = {};
FW.core = {};
FW.prep = f => {
  const tot = Object.values(f.mix).reduce((a, b) => a + b, 0) || 1;
  const t = f.tone || 0, shade = c => t ? mixHex(c, t > 0 ? '#FFFFFF' : '#000000', Math.abs(t)) : c;
  f.parts = Object.entries(f.mix).map(([fam, w]) => ({ fam, w: w / tot, color: shade(FW.fam[fam].color) })).sort((a, b) => b.w - a.w);
  f.mix = Object.fromEntries(f.parts.map(p => [p.fam, p.w]));
  f.dom = f.parts[0].fam;
  f.blend = f.parts.length > 1;
  f.avg = rgb2hex(f.parts.reduce((acc, p) => { const c = hex2rgb(p.color); return acc.map((v, i) => v + c[i] * p.w); }, [0, 0, 0]));
  f.ink = inkFor(f.avg);
  f.lite = lum(f.avg) <= 0.36;
  return f;
};
D.feelings.forEach(f => { FW.prep(f); FW.byId[f.id] = f; if (f.core) FW.core[f.dom] = f; });

/* thesaurus: each synonym is a light word that borrows its head feeling's colours, nudged a touch
   lighter or darker (`tone`, stable per word) so a ring of synonyms never reads as one flat colour */
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
FW.syns = [];
D.feelings.forEach(f => (f.syn || []).forEach(s => {
  if (FW.byId[s.id]) return;
  const w = { ...s, head: f.id, mix: { ...f.mix }, level: f.level, cluster: f.cluster, also: f.also, def: s.means || f.def, tone: ((hash(s.id) % 1000) / 1000 - 0.5) * 0.3 };
  FW.byId[w.id] = FW.prep(w); FW.syns.push(w);
}));
/* the head feeling's words (everyday first, then the deep cuts), for a feeling or any of its synonyms */
FW.words = id => {
  const f = FW.byId[id], h = f && (f.head ? FW.byId[f.head] : f);
  return h ? (h.syn || []).map(s => FW.byId[s.id]).filter(w => w && w.head === h.id) : [];
};
FW.content = id => (window.FEELINGS_CONTENT || {})[id] || {};

/* family colours, label inks and the label face come from src/tokens.css */
const label = { family: 'Georgia, serif', weight: 800, track: 0.02 };
FW.applyTokens = () => {
  T.refresh();
  const css = n => T.css(n);
  FW.ink.dark = toHex(css('--fw-color-label-dark')) || FW.ink.dark;
  FW.ink.light = toHex(css('--fw-color-label-light')) || FW.ink.light;
  D.families.forEach(F => { F.color = toHex(css('--fw-color-' + F.id)) || F.color; F.ink = inkFor(F.color); });
  FW.list.forEach(FW.prep);
  FW.syns.forEach(FW.prep);
  label.family = css('--fw-font-display') || label.family;
  label.weight = parseFloat(css('--fw-font-weight-heavy')) || label.weight;
  const tr = css('--fw-tracking-label');
  label.track = /em$/.test(tr) ? parseFloat(tr) || 0 : label.track;
  FW.glowAlpha = (parseFloat(css('--fw-opacity-glow')) || 30) / 100;
};

/* ---------- geometry + similarity ---------- */
FW.pos = (f, R = 1) => {
  let x = 0, y = 0;
  f.parts.forEach(p => { const a = FW.fam[p.fam].rad; x += Math.cos(a) * p.w; y += Math.sin(a) * p.w; });
  const s = R * (0.5 + 0.1 * (f.level || 3));
  return { x: x * s, y: y * s };
};
FW.sim = (a, b) => {
  let d = 0, na = 0, nb = 0;
  FW.fams.forEach(F => { const x = a.mix[F.id] || 0, y = b.mix[F.id] || 0; d += x * y; na += x * x; nb += y * y; });
  return d / (Math.sqrt(na * nb) || 1) - 0.04 * Math.abs((a.level || 3) - (b.level || 3));
};

/* ---------- clusters + links ----------
   Each feeling lives in one cluster (love, desire, wonder…) and may join others via `also`.
   Clusters list their neighbours (`near`) and the doorway words that lead into them (`via`). */
FW.clusters = D.clusters || [];
FW.cluster = Object.fromEntries(FW.clusters.map(c => [c.id, c]));
const back = {};
D.feelings.forEach(g => Object.entries(g.links || {}).forEach(([k, ts]) => ts.forEach(t => { const b = back[t] = back[t] || {}; (b[k] = b[k] || []).push(g.id); })));

/* every related feeling, best first, each with a short caption explaining the connection.
   Order matters: the first 7 fill the inner ring (closest kin), the next 8 the outer ring (doorways
   into neighbouring clusters), and the rest are paged in with the "+ more" bubble. */
FW.related = id => {
  const f = FW.byId[id]; if (!f) return [];
  const out = [], seen = new Set([id]);
  const add = (gid, cap = '') => { if (!gid || seen.has(gid) || !FW.byId[gid]) return; seen.add(gid); out.push({ id: gid, cap }); };
  const L = f.links || {}, Bk = back[id] || {};
  const bySim = ids => [...new Set(ids)].map(g => FW.byId[g]).filter(Boolean).sort((a, b) => FW.sim(f, b) - FW.sim(f, a)).map(g => g.id);
  const cname = cid => (FW.cluster[cid] ? FW.cluster[cid].name.toLowerCase() : '');
  const homes = [f.cluster, ...(f.also || [])].map(c => FW.cluster[c]).filter(Boolean);

  [...(L.stronger || []), ...(Bk.softer || [])].forEach(g => add(g, 'stronger'));
  [...(L.softer || []), ...(Bk.stronger || [])].forEach(g => add(g, 'softer'));
  (L.under || []).forEach(g => add(g, 'underneath'));
  [...(L.see || []), ...(Bk.see || [])].forEach(g => add(g));

  if (f.core) {
    /* a family hub: open the doors to every cluster in this family, then the blends that lean on it */
    const own = FW.clusters.filter(c => c.family === f.dom && c.anchor !== id);
    own.forEach(c => add(c.anchor, cname(c.id)));
    FW.clusters.filter(c => c.family !== f.dom && (FW.byId[c.anchor]?.mix[f.dom] || 0) >= 0.3).forEach(c => add(c.anchor, 'mix'));
    (L.opposite || []).forEach(g => add(g, 'opposite'));
    bySim(homes.flatMap(c => c.members)).forEach(g => add(g));
    bySim(FW.list.filter(g => g.dom === f.dom && !g.core).map(g => g.id)).forEach(g => add(g));
    FW.list.filter(g => g.dom !== f.dom && !g.core && (g.mix[f.dom] || 0) >= 0.3)
      .sort((a, b) => (b.mix[f.dom] || 0) - (a.mix[f.dom] || 0)).forEach(g => add(g.id, 'mix'));
    return out;
  }

  const kin = bySim(homes.flatMap(c => c.members));
  kin.forEach(g => { if (out.length < 7) add(g); });
  homes.forEach(c => (c.near || []).forEach(n => n.via.forEach(g => add(g, cname(n.id)))));
  [...(L.opposite || []), ...(Bk.opposite || [])].forEach(g => add(g, 'opposite'));
  kin.forEach(g => add(g));
  (Bk.under || []).forEach(g => add(g, 'on the surface'));
  f.parts.filter(p => p.w >= 0.25).forEach(p => add(FW.core[p.fam] && FW.core[p.fam].id, 'family'));
  homes.forEach(c => (c.near || []).forEach(n => bySim(FW.cluster[n.id].members).slice(0, 3).forEach(g => add(g, cname(n.id)))));
  let n = 0;
  FW.list.filter(g => !g.core && !seen.has(g.id)).map(g => [g.id, FW.sim(f, g)]).sort((a, b) => b[1] - a[1])
    .forEach(([g]) => { if (n++ < 8) add(g, 'nearby'); });
  return out;
};
/* ---------- gradients ---------- */
const SPOTS = [[34, 36], [66, 62], [40, 70], [64, 32]];
FW.fillCSS = f => {
  const parts = f.parts || [];
  if (!parts.length) return 'var(--line)';
  if (parts.length === 1) return parts[0].color; /* flat fill — gloss removed in Paper */
  const spots = parts.slice(0, 4).map((p, i) => {
    const r = Math.round(22 + p.w * 44), [x, y] = SPOTS[i];
    return `radial-gradient(${r}% ${r}% at ${x}% ${y}%, ${p.color} 0%, ${alpha(p.color, 0.85)} 40%, ${alpha(p.color, 0)} 100%)`;
  });
  const cols = parts.map(p => p.color);
  return spots.join(', ') + `, conic-gradient(from 30deg, ${cols.join(', ')}, ${cols[0]})`;
};

/* ---------- labels ---------- */
const HY = { unappreciated: 'unappre-ciated', disappointed: 'disap-pointed', overwhelmed: 'over-whelmed', heartbroken: 'heart-broken',
  bittersweet: 'bitter-sweet', determined: 'deter-mined', vindicated: 'vindi-cated', appreciated: 'appre-ciated', frustrated: 'frus-trated',
  nostalgic: 'nos-talgic', confident: 'confi-dent', resentful: 'resent-ful', defensive: 'defen-sive', irritated: 'irri-tated' };
/* automatic hyphenation for long single words: prefer VC|CV splits near the middle, keep
   digraphs/onsets (th, ch, tr, pl…) together, favour suffixes. A feeling's own `hy` wins. */
const VOW = /[aeiouy]/, KEEP = /^(th|sh|ch|ph|wh|ck|ng|gh|qu|[bcdfgkpt][rl])$/, SUF = /^(ful|less|ness|ment|ship|hood|able|ible)$/;
FW.hyphen = w => {
  if (HY[w]) return HY[w];
  if (w.length < 9 || /[\s-]/.test(w)) return w;
  const mid = w.length / 2; let best = -1, bs = 1e9;
  for (let i = 3; i <= w.length - 3; i++) {
    const a = w[i - 1], b = w[i], n = w[i + 1] || '';
    const cc = !VOW.test(a) && !VOW.test(b) && !KEEP.test(a + b);
    const vcv = VOW.test(a) && !VOW.test(b) && VOW.test(n);
    if (!cc && !vcv) continue;
    const sc = Math.abs(i - mid) + (cc ? 0 : 0.5) - (SUF.test(w.slice(i)) ? 1.5 : 0);
    if (sc < bs) { bs = sc; best = i; }
  }
  return best > 0 ? w.slice(0, best) + '-' + w.slice(best) : w;
};
/* labels are measured with the real display face, so any font Nick picks still fits */
let mctx = null;
const em = t => {
  mctx = mctx || document.createElement('canvas').getContext('2d');
  mctx.font = `${label.weight} 100px ${label.family}`;
  return mctx.measureText(t).width / 100 + label.track * t.length;
};
FW.fitLabel = (word, s, f) => {
  const hy = (f && f.hy) || FW.hyphen(word);
  const brk = [];
  for (let i = 1; i < hy.length - 1; i++) if (hy[i] === ' ' || hy[i] === '-') brk.push(i);
  /* split at the chosen break points; a space disappears, a hyphen stays on the line above */
  const cut = at => { const out = []; let a = 0; at.forEach(i => { out.push(hy.slice(a, hy[i] === ' ' ? i : i + 1)); a = i + 1; }); out.push(hy.slice(a)); return out; };
  const best = sets => sets.map(cut).reduce((b, l) => !b || Math.max(...l.map(em)) < Math.max(...b.map(em)) ? l : b, null);
  const cands = [{ lines: [word] }];
  if (brk.length) cands.push({ lines: best(brk.map(i => [i])) });
  if (brk.length > 1) cands.push({ lines: best(brk.flatMap((i, x) => brk.slice(x + 1).map(j => [i, j]))) });
  const cap = [0.22, 0.2, 0.18], wide = [0.78, 0.78, 0.74];
  cands.forEach(c => { const n = c.lines.length - 1; c.size = Math.min(s * cap[n], wide[n] * s / Math.max(...c.lines.map(em))); });
  let pick = cands[0];
  if (pick.size < 0.15 * s && cands[1] && cands[1].size > pick.size) pick = cands[1];
  if (pick.size < 0.15 * s && cands[2] && cands[2].size > pick.size * 1.08) pick = cands[2];
  let size = pick.size, cond = false;
  if (size < 0.13 * s) { cond = true; size = Math.min(s * cap[pick.lines.length - 1], size / 0.88); }
  return { html: pick.lines.map(esc).join('<br>'), size, cond };
};

/* ---------- bubble element ---------- */
FW.bubble = (f, o = {}) => {
  const s = o.size || 100;
  const el = document.createElement('div');
  el.className = 'node' + (f.blend ? ' blend' : '') + (f.syn && f.syn.length ? ' has-syn' : '') + (f.head ? ' syn' : '') + (f.deep ? ' deep' : '');
  el.dataset.id = f.id;
  el.style.setProperty('--s', s + 'px');
  el.style.setProperty('--ink', f.ink);
  const L = FW.fitLabel(f.word, s, f);
  el.innerHTML = `<div class="grip"><div class="float"><div class="halo"></div><div class="bubble"><div class="fill"></div>` +
    `<div class="label${f.lite ? ' lite' : ''}" style="font-size:${L.size.toFixed(1)}px;${L.cond ? 'font-stretch:87%;' : ''}">${L.html}</div></div>` +
    `<div class="cap"></div></div></div>`;
  el.querySelector('.fill').style.background = FW.fillCSS(f);
  el._tw = [];
  if (!o.static && !reduce) {
    const R = gsap.utils.random, fl = T.motion('float'), sp = T.motion('blend-spin');
    const dr = [].concat(fl.drift ?? [3, 6]), dx = dr[0], dy = dr[1] ?? dr[0];
    el._tw.push(gsap.to(el.querySelector('.float'), { x: R(-dx, dx), y: R(-dy, dy), duration: R(fl.dur, fl.dur2), ease: fl.ease, yoyo: true, repeat: -1, delay: R(0, 1.5) }));
    if (f.blend && o.spin !== false) el._tw.push(gsap.to(el.querySelector('.fill'), { rotation: 360, duration: R(sp.dur, sp.dur2), ease: sp.ease, repeat: -1 }));
  }
  return el;
};
FW.dispose = el => { (el._tw || []).forEach(t => t.kill()); gsap.killTweensOf(el); gsap.killTweensOf(el.querySelector('.grip')); el.remove(); };
/* the live, tappable bubble for a feeling (exiting and hidden ones carry .off) */
FW.nodeFor = id => id && FW.els ? FW.els.stage.querySelector(`.node[data-id="${CSS.escape(id)}"]:not(.off)`) : null;

/* ---------- press / long-press / drag gesture ---------- */
FW.press = (el, h) => {
  let st = null, last = null, timer = null, moved = false, longed = false;
  const grip = el.querySelector('.grip') || el;
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    const t = performance.now();
    st = { x: e.clientX, y: e.clientY }; last = { x: e.clientX, y: e.clientY, t, vx: 0, vy: 0 };
    moved = false; longed = false;
    const pr = T.motion('press'), rl = T.motion('release');
    gsap.to(grip, { scale: pr.scale ?? 0.92, duration: FW.dur(pr.dur), ease: pr.ease, overwrite: 'auto' });
    if (h.onLong) timer = setTimeout(() => { if (!moved && st) { longed = true; gsap.to(grip, { scale: 1, duration: FW.dur(rl.dur), ease: rl.ease }); h.onLong(); } }, T.motion('hold').dur * 1000);
    h.onDown && h.onDown(e);
  });
  el.addEventListener('pointermove', e => {
    if (!st) return;
    const now = performance.now(), dt = Math.max(1, now - last.t);
    last = { x: e.clientX, y: e.clientY, t: now, vx: (e.clientX - last.x) / dt, vy: (e.clientY - last.y) / dt };
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!moved && Math.hypot(dx, dy) > 9) { moved = true; clearTimeout(timer); }
    if (moved && h.onDrag) h.onDrag(dx, dy, e);
  });
  const end = e => {
    if (!st) return;
    clearTimeout(timer);
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    st = null;
    const rl = T.motion('release');
    gsap.to(grip, { scale: 1, duration: FW.dur(rl.dur), ease: rl.ease, overwrite: 'auto' });
    if (moved) { h.onRelease && h.onRelease(dx, dy, last.vx, last.vy, e); }
    else if (!longed && e.type === 'pointerup') { h.onTap && h.onTap(e); }
    h.onEnd && h.onEnd(e);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
};
/* ---------- events, toast, clipboard ---------- */
const bus = {};
FW.on = (ev, fn) => (bus[ev] = bus[ev] || []).push(fn);
FW.emit = (ev, d) => (bus[ev] || []).forEach(fn => fn(d));
FW.toast = msg => {
  const t = FW.els && FW.els.toast; if (!t) return;
  t.textContent = msg;
  gsap.killTweensOf(t);
  const m = T.motion('toast');
  gsap.timeline().fromTo(t, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: FW.dur(m.dur), ease: m.ease })
    .to(t, { opacity: 0, y: -10, duration: FW.dur(m.dur) }, '+=' + (m.hold ?? 1.6));
};
FW.copy = async (text, msg) => {
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) {} ta.remove();
  }
  FW.toast(msg || 'Copied');
};
FW.share = async (text, title) => {
  if (navigator.share) { try { await navigator.share({ text, title }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  FW.copy(text, 'Copied — paste it anywhere');
};
FW.mixChips = f => f.parts.map(p => `<span class="mixchip" style="background:${FW.fam[p.fam].color};color:${FW.fam[p.fam].ink}">${FW.fam[p.fam].name}</span>`).join('');

/* fallbacks until dock.js loads */
FW.isPinned = FW.isPinned || (() => false);
FW.pin = FW.pin || (id => FW.toast('Pinned ' + FW.byId[id].word));
FW.unpin = FW.unpin || (() => {});

/* ---------- mount the phone frame ---------- */
FW.mount = (o = {}) => {
  const frame = document.getElementById('frame');
  frame.dataset.variant = o.variant || '';
  frame.dataset.theme = localStorage.getItem('fw.theme') || 'ink';
  frame.innerHTML = `<canvas class="aura" id="aura" aria-hidden="true"></canvas><div class="glow" id="glow"></div><div class="stage" id="stage"></div>
<div class="topbar" id="topbar"><div class="dock" id="dock" role="button" aria-label="My wheel"><div class="wheel" id="wheel"><svg viewBox="0 0 100 100"><defs></defs><circle class="track" cx="50" cy="50" r="38.5"></circle><g class="segs"></g></svg><div class="wheel-core"><div class="fill"></div></div><div class="badge" id="badge">0</div></div><div class="dock-label">my wheel</div></div><button class="iconbtn" id="themeBtn" title="Theme">◐</button></div>
<div class="hud" id="hud"><div class="trail" id="trail"></div><div class="peek" id="peek"></div></div>
<div class="fly" id="fly"></div><div class="scrim" id="scrim"></div><div class="drawer" id="drawer"></div><div class="toast" id="toast"></div>
<div class="probe" id="satProbe"></div><div class="probe" id="sabProbe"></div>`;
  const $ = id => frame.querySelector('#' + id);
  FW.els = { frame, aura: $('aura'), glow: $('glow'), stage: $('stage'), topbar: $('topbar'), hud: $('hud'), trail: $('trail'), peek: $('peek'),
    dock: $('dock'), wheel: $('wheel'), fly: $('fly'), scrim: $('scrim'), drawer: $('drawer'), toast: $('toast'), badge: $('badge') };
  FW.measure = () => {
    FW.W = frame.clientWidth; FW.H = frame.clientHeight;
    FW.safe = { top: $('satProbe').offsetHeight, bottom: $('sabProbe').offsetHeight };
  };
  FW.measure();
  /* the open band bubbles can use: under the top bar, above the trail + peek card at the bottom */
  FW.room = () => {
    const { topbar, hud } = FW.els;
    return { top: topbar.offsetTop + topbar.offsetHeight + 10, bottom: hud.offsetHeight ? hud.offsetTop - 12 : FW.H - FW.safe.bottom - 24 };
  };
  $('themeBtn').onclick = () => {
    const t = frame.dataset.theme === 'ink' ? 'poster' : 'ink';
    frame.dataset.theme = t; localStorage.setItem('fw.theme', t);
    FW.toast(t === 'ink' ? 'Ink theme' : 'Poster theme');
  };
  FW.initDock && FW.initDock();
  FW.initDrawer && FW.initDrawer();
  FW.initAura && FW.initAura();
  return FW.els;
};

/* soft background glow tinted toward the current feeling */
FW.tint = hex => {
  const m = T.motion('tint');
  return gsap.to(FW.els.glow, { '--glow': hex ? alpha(hex, FW.glowAlpha ?? 0.3) : 'rgba(0,0,0,0)', duration: FW.dur(m.dur), ease: m.ease });
};

/* ---------- peek card ----------
   A feeling shows its clusters and a "≈ N words" chip that opens its thesaurus orbit.
   A synonym shows "≈ its feeling", how to say it, where it comes from, and a chip back to its feeling. */
FW.peek = id => {
  const p = FW.els.peek;
  if (!id) { FW._peekId = null; gsap.to(p, { y: 24, autoAlpha: 0, duration: FW.dur(0.25), ease: 'power2.in', overwrite: true, onComplete: () => { p.style.display = ''; } }); return; }
  const f = FW.byId[id], h = f.head && FW.byId[f.head];
  const same = FW._peekId === id;
  FW._peekId = id;
  p.style.display = 'block';
  const where = h ? `\u2248 ${h.word}` + (f.lang ? ` · ${f.lang}` : f.deep ? ' · uncommon' : '')
    : [f.cluster, ...(f.also || [])].map(c => FW.cluster[c] && FW.cluster[c].name).filter(Boolean).join(' · ');
  const n = h ? 0 : FW.words(id).length;
  const chip = h ? `<button class="pchip" data-act="head"><i style="background:${FW.fillCSS(h)}"></i>\u21a9 ${esc(h.word)}</button>`
    : n ? `<button class="pchip" data-act="words">\u2248 ${n} word${n > 1 ? 's' : ''} for this</button>` : '';
  p.innerHTML = `<div class="ph"><span class="dot" style="background:${FW.fillCSS(f)}"></span><div class="pw">` +
    (where ? `<div class="eyebrow">${esc(where)}</div>` : '') +
    `<div class="w">${esc(f.word)}${f.sounds ? `<span class="say">${esc(f.sounds)}</span>` : ''}</div>` +
    `<div class="mix">${FW.mixChips(f)}</div></div><button class="pinbtn" id="peekPin"></button></div>` +
    (f.def ? `<div class="def">${esc(f.def)}</div>` : '') +
    (f.from ? `<div class="from"><b>from</b> ${esc(f.from)}</div>` : '') +
    (chip ? `<div class="prow">${chip}</div>` : '');
  FW.syncPeek();
  p.querySelector('#peekPin').onclick = () => {
    if (FW.isPinned(id)) FW.unpin(id);
    else FW.pin(id, FW.nodeFor(id));
  };
  p.querySelectorAll('.pchip').forEach(b => { b.onclick = () => FW.emit('peek', { act: b.dataset.act, id }); });
  const m = T.motion('peek-in');
  if (!same) gsap.fromTo(p, { y: m.rise ?? 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: FW.dur(m.dur), ease: m.ease, overwrite: true });
};
FW.syncPeek = () => {
  const P = FW.els && FW.els.peek; if (!P) return;
  const w = P.querySelector('[data-act=words]');
  if (w) w.classList.toggle('on', !!FW.wordsOpen);
  const b = P.querySelector('#peekPin'); if (!b) return;
  const on = FW.isPinned(FW._peekId);
  b.textContent = on ? 'Pinned ✓' : '+ Pin';
  b.classList.toggle('on', on);
};
FW.on('pins', () => FW.syncPeek());
})();
