/* Feelings wheel — dock: pins, the wheel (top left), pin flight. Each deck keeps its own pins. */
(function () {
const FW = window.FW, NS = 'http://www.w3.org/2000/svg';
const R1 = 46, R0 = 31, C = 50, RM = 38.5;
const load = () => { try { return (JSON.parse(localStorage.getItem(FW.UI.pins)) || []).filter(p => FW.byId[p.id]).map(({ id, t }) => ({ id, t })); } catch (e) { return []; } };
FW.pins = load();
const landing = new Set(), segs = new Map(), grads = new Set();
let defs, g, coreFill, badge;

const save = () => { try { localStorage.setItem(FW.UI.pins, JSON.stringify(FW.pins)); } catch (e) {} FW.emit('pins', FW.pins); };
FW.isPinned = id => FW.pins.some(p => p.id === id);
FW.pin = (id, srcEl) => {
  const f = FW.byId[id]; if (!f) return;
  if (FW.isPinned(id)) { FW.toast(f.word + ' is already on your wheel'); return; }
  FW.pins.push({ id, t: Date.now() });
  landing.add(id);
  save();
  flight(id, srcEl, () => { landing.delete(id); syncWheel(); bump(); FW.toast('Pinned ' + f.word); });
};
FW.unpin = id => { FW.pins = FW.pins.filter(p => p.id !== id); save(); FW.toast('Unpinned ' + FW.byId[id].word); };
FW.clearPins = () => { FW.pins = []; save(); };
FW.aggregate = () => {
  const acc = {}; let tot = 0;
  FW.pins.forEach(p => FW.byId[p.id].parts.forEach(q => { acc[q.fam] = (acc[q.fam] || 0) + q.w; tot += q.w; }));
  return Object.entries(acc).map(([fam, w]) => ({ fam, w: w / (tot || 1), color: FW.fam[fam].color })).sort((a, b) => b.w - a.w);
};

/* ---------- wheel drawing ---------- */
const pt = (r, a) => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
const arc = (a0, a1) => {
  const span = a1 - a0;
  if (span < 0.002) return '';
  if (span >= Math.PI * 2 - 0.002) return `M ${pt(R1, a0)} A ${R1} ${R1} 0 1 1 ${pt(R1, a0 + Math.PI)} A ${R1} ${R1} 0 1 1 ${pt(R1, a0)} Z M ${pt(R0, a0)} A ${R0} ${R0} 0 1 0 ${pt(R0, a0 + Math.PI)} A ${R0} ${R0} 0 1 0 ${pt(R0, a0)} Z`;
  const big = span > Math.PI ? 1 : 0;
  return `M ${pt(R1, a0)} A ${R1} ${R1} 0 ${big} 1 ${pt(R1, a1)} L ${pt(R0, a1)} A ${R0} ${R0} 0 ${big} 0 ${pt(R0, a0)} Z`;
};
const draw = s => s.el.setAttribute('d', arc(s.a0, s.a1));
function targets() {
  const list = FW.pins.filter(p => !landing.has(p.id));
  const span = Math.PI * 2 / (list.length || 1), gap = list.length > 1 ? 0.05 : 0;
  let a = -Math.PI / 2; const out = {};
  list.forEach(p => { out[p.id] = { a0: a + gap / 2, a1: a + span - gap / 2, mid: a + span / 2 }; a += span; });
  return out;
}
function grad(f) {
  const id = `wg-${FW.deck.id}-${f.id}`;
  if (grads.has(id)) return id;
  grads.add(id);
  const lg = document.createElementNS(NS, 'linearGradient');
  lg.id = id; lg.setAttribute('x1', '0'); lg.setAttribute('y1', '0'); lg.setAttribute('x2', '1'); lg.setAttribute('y2', '1');
  const cols = f.parts.length > 1 ? f.parts.map(p => p.color) : [FW.color.mixHex(f.parts[0].color, '#ffffff', 0.3), f.parts[0].color];
  cols.forEach((c, i) => { const st = document.createElementNS(NS, 'stop'); st.setAttribute('offset', (i / (cols.length - 1) * 100) + '%'); st.setAttribute('stop-color', c); lg.appendChild(st); });
  defs.appendChild(lg);
  return id;
}
const collapse = s => {
  const m = (s.a0 + s.a1) / 2;
  gsap.to(s, { a0: m, a1: m, duration: FW.dur(0.4), ease: 'power2.in', overwrite: true, onUpdate: () => draw(s), onComplete: () => s.el.remove() });
};
function syncWheel() {
  if (!g) return;
  const T = targets();
  segs.forEach((s, id) => { if (!T[id]) { segs.delete(id); collapse(s); } });
  Object.entries(T).forEach(([id, t]) => {
    let s = segs.get(id);
    if (!s) {
      const el = document.createElementNS(NS, 'path');
      el.setAttribute('fill', `url(#${grad(FW.byId[id])})`); el.setAttribute('fill-rule', 'evenodd');
      g.appendChild(el); s = { a0: t.mid, a1: t.mid, el }; segs.set(id, s);
    }
    gsap.to(s, { a0: t.a0, a1: t.a1, duration: FW.dur(0.7), ease: 'power3.out', overwrite: true, onUpdate: () => draw(s) });
  });
  const agg = FW.aggregate();
  coreFill.style.background = agg.length ? FW.fillCSS({ parts: agg }) : '';
  badge.textContent = FW.pins.length;
  badge.style.display = FW.pins.length ? '' : 'none';
}
const bump = () => gsap.fromTo(FW.els.wheel, { scale: 1.2 }, { scale: 1, duration: FW.dur(1), ease: 'elastic.out(1,.35)', overwrite: true });

/* ---------- pin flight: bubble arcs into its slot on the wheel ---------- */
function flight(id, srcEl, done) {
  const f = FW.byId[id], fr = FW.els.frame.getBoundingClientRect(), wr = FW.els.wheel.getBoundingClientRect();
  const b = srcEl && srcEl.isConnected && (srcEl.querySelector('.bubble') || srcEl);
  let sx = fr.width / 2, sy = fr.height * 0.42, size = 90;
  if (b) { const r = b.getBoundingClientRect(); sx = r.left - fr.left + r.width / 2; sy = r.top - fr.top + r.height / 2; size = r.width; }
  landing.delete(id); const t = targets()[id]; landing.add(id);
  const mid = t ? t.mid : -Math.PI / 2, sc = wr.width / 100;
  const wx = wr.left - fr.left + (C + RM * Math.cos(mid)) * sc, wy = wr.top - fr.top + (C + RM * Math.sin(mid)) * sc;
  /* bow the arc sideways off the straight line (upward when it can), kept inside the frame */
  const dx = wx - sx, dy = wy - sy, L = Math.hypot(dx, dy) || 1, bow = Math.min(120, L * 0.3);
  let nx = -dy / L, ny = dx / L;
  if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
  const kx = Math.max(24, Math.min(fr.width - 24, (sx + wx) / 2 + nx * bow));
  const ky = Math.max(24 + (FW.safe ? FW.safe.top : 0), Math.min(fr.height - 24, (sy + wy) / 2 + ny * bow));
  const clone = FW.bubble(f, { size: 100, static: true });
  FW.els.fly.appendChild(clone);
  gsap.set(clone, { x: sx, y: sy, scale: size / 100 });
  gsap.timeline({ onComplete: () => { clone.remove(); done && done(); } })
    .to(clone, { scale: size / 100 * 1.15, duration: FW.dur(0.16), ease: 'power2.out' })
    .to(clone, { motionPath: { path: [{ x: sx, y: sy }, { x: kx, y: ky }, { x: wx, y: wy }], curviness: 1.4 },
      scale: 0.12, duration: FW.dur(0.75), ease: 'power2.in' });
}

FW.initDock = () => {
  const svg = FW.els.wheel.querySelector('svg');
  defs = svg.querySelector('defs'); g = svg.querySelector('.segs');
  coreFill = FW.els.wheel.querySelector('.wheel-core .fill'); badge = FW.els.badge;
  segs.clear();
  if (!FW.reduce) gsap.to(coreFill, { rotation: 360, duration: 24, ease: 'none', repeat: -1 });
  syncWheel();
  label();
  /* the wheel sits top left: tap it, or pull it down, to open the drawer */
  let y0 = null;
  FW.els.dock.addEventListener('pointerdown', e => { y0 = e.clientY; });
  FW.els.dock.addEventListener('pointerup', e => {
    if (y0 === null) return;
    const dy = e.clientY - y0; y0 = null;
    if (dy > 24 || Math.abs(dy) < 8) FW.openDrawer ? FW.openDrawer() : FW.toast('Drawer arrives next');
  });
};
FW.on('pins', () => syncWheel());
/* the deck's name for the wheel: "my wheel" / "their wheel" */
function label() {
  const el = FW.els && FW.els.dockLabel; if (!el) return;
  el.textContent = FW.UI.dock();
  FW.els.dock.setAttribute('aria-label', FW.UI.dock());
}
/* switching decks: the old wheel folds away and the new deck's pins grow in */
FW.on('deck', () => {
  landing.clear();
  segs.forEach(collapse); segs.clear();
  FW.pins = load();
  syncWheel();
  label();
});
})();
