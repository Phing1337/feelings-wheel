/* Orbit — a feeling's thesaurus. Tap the feeling in the middle and its words revolve around it:
   everyday words on the inner ring, the rare and strange ones on the outer ring. Tap a word to
   bring it to the middle, hold to pin it, drag anywhere to spin a ring. When a ring has more words
   than fit, the extras stream in through a gate at the top as it turns.
   Sizes come from --fw-layout-synonyms-*, timing from --fw-motion-synonyms-*. */
const FW = window.FW;
const TAU = Math.PI * 2, GATE = -Math.PI / 2, B = 100;
const wrapS = a => a - TAU * Math.floor((a + Math.PI) / TAU);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createOrbit(stage, host) {
  const T = FW.tok;
  const bodies = new Map(), dying = new Set();
  let on = false, closing = false, ticking = false, headId = null, mid = null, rings = [];
  let C = null, G = null, drag = null, bg = null, fr = null;

  /* ---------- geometry: rings are ellipses, slots are spaced evenly by angle ---------- */
  const rad = (R, a) => R.rx * R.ry / Math.hypot(R.ry * Math.cos(a), R.rx * Math.sin(a));

  /* where everything wants to be; the live geometry glides toward this every frame. The outermost
     ring sets the scale: as big as the design asks, but never taller or wider than the room between
     the top bar and the peek card */
  function targets() {
    const W = FW.W, H = FW.H, { top, bottom: bot } = FW.room();
    const half = Math.max(90, (bot - top) / 2), O = rings[rings.length - 1], ro = B * O.sc0 / 2;
    const k = Math.min(W / 390, H / 844, T.layout('max-zoom')[0] ?? 1.15, half / (O.ry0 + ro), (W / 2 - 6) / (O.rx0 + ro * (1 - O.sq)));
    G = { x: W / 2, y: top + half, s: (T.layout('synonyms-center')[0] ?? 1) * k };
    rings.forEach(R => { R.tx = R.rx0 * k; R.ty = R.ry0 * k; R.ts = R.sc0 * k; });
  }

  /* how many moons fit round a ring without touching (moons shrink toward the sides) */
  function capacity(R) {
    let n = Infinity;
    for (let i = 0; i <= 12; i++) {
      const a = i / 12 * Math.PI / 2, c = Math.cos(a), r = R.tx * R.ty / Math.hypot(R.ty * c, R.tx * Math.sin(a));
      n = Math.min(n, Math.floor(TAU * r / (B * R.ts * (1 - R.sq * c * c) * 1.12)));
    }
    return Math.max(3, n);
  }

  function build(at) {
    const words = FW.words(headId);
    const lists = [words.filter(w => !w.deep), words.filter(w => w.deep)].map(l => l.map(w => w.id)).filter(l => l.length);
    /* opened on a word: it takes the middle and the feeling joins the front of its ring */
    if (at && at !== headId) { const l = lists.find(x => x.includes(at)); if (l) { l.splice(l.indexOf(at), 1); l.unshift(headId); } }
    const spin = T.motion('synonyms-revolve'), geo = [T.layout('synonyms-inner'), T.layout('synonyms-outer')];
    const def = [[90, 92, 0.6, 12], [160, 160, 0.56, 22]];
    rings = lists.map((ids, i) => {
      const [rx0, ry0, sc0, sq] = def[i].map((d, n) => geo[i][n] ?? d);
      const dir = i ? -1 : 1, w0 = FW.reduce ? 0 : dir * TAU / Math.max(1, i ? spin.dur2 : spin.dur);
      return { i, ids, rx0, ry0, sc0, sq: sq / 100, dir, w0, w: w0, held: 0 };
    });
    targets();
    C = { ...G };
    rings.forEach(R => {
      R.rx = R.tx; R.ry = R.ty; R.sc = R.ts;
      R.S = Math.min(R.ids.length, capacity(R));
      R.step = TAU / R.S;
      R.theta = GATE + R.step / 2;
      R.queue = R.ids.slice(R.S);
      R.slots = new Array(R.S).fill(null);
      R.lap = R.slots.map((_, j) => Math.floor((R.theta + j * R.step - GATE) / TAU));
    });
  }

  function slot(b) {
    const R = b.R, a = R.theta + b.j * R.step, r = rad(R, a), c = Math.cos(a);
    let s = R.sc * (1 - R.sq * c * c);
    if (R.queue.length && !b.sticky && !b.hold) {
      const d = Math.abs(wrapS(a - GATE)) / R.step;
      if (d < 0.5) s *= Math.sin(Math.PI * d) ** 2;
    }
    return { x: C.x + c * r, y: C.y + Math.sin(a) * r, s };
  }

  /* ---------- bodies ---------- */
  /* quickSetter can't take 'scale' (gsap treats it as two properties), so set both axes */
  function body(id, el, R, j) {
    const kx = gsap.quickSetter(el, 'scaleX'), ky = gsap.quickSetter(el, 'scaleY');
    const b = { id, el, f: FW.byId[id], R, j, where: R ? 'ring' : 'mid', tr: null, hold: false, heldR: null, sticky: id === headId,
      at: { x: gsap.getProperty(el, 'x'), y: gsap.getProperty(el, 'y'), s: gsap.getProperty(el, 'scale') },
      sx: gsap.quickSetter(el, 'x', 'px'), sy: gsap.quickSetter(el, 'y', 'px'), ss: s => { kx(s); ky(s); } };
    bodies.set(id, b);
    if (R) R.slots[j] = b;
    return b;
  }
  function make(id, R, j) {
    const el = FW.bubble(FW.byId[id], { size: B, spin: false });
    gsap.set(el, { x: C.x, y: C.y, scale: 0 });
    stage.appendChild(el);
    const b = body(id, el, R, j);
    FW.press(el, hand(b));
    style(b);
    return b;
  }
  function style(b) {
    const c = b === mid;
    b.el.classList.toggle('is-focus', c);
    b.el.classList.toggle('moon', !c);
    b.el.classList.toggle('is-head', !c && b.id === headId);
    b.el.classList.toggle('is-pinned', FW.isPinned(b.id));
    b.el.style.zIndex = c ? 5 : b.R ? 4 - b.R.i : 3;
  }
  function move(b, where, R, j, m, done) {
    b.where = where; b.R = R; b.j = j;
    b.tr = { kind: 'move', from: { ...b.at }, t0: gsap.ticker.time, dur: FW.dur(m.dur), ease: gsap.parseEase(m.ease), done };
  }

  function place(b, now) {
    let x, y, s;
    if (b.where === 'mid') { x = C.x; y = C.y; s = C.s; }
    else if (b.where === 'ring') ({ x, y, s } = slot(b));
    else { x = C.x; y = C.y; s = 0; }
    const tr = b.tr;
    let done = false;
    if (tr) {
      const p = (now - tr.t0) / tr.dur;
      if (p < 0) ({ x, y, s } = tr.kind === 'enter' ? { x: C.x, y: C.y, s: 0 } : tr.from);
      else if (p >= 1) { b.tr = null; done = true; }
      else {
        const e = tr.ease(p);
        if (tr.kind === 'enter') {
          /* grow out of the middle, swinging round the way the ring turns */
          const dx = x - C.x, dy = y - C.y, a = Math.atan2(dy, dx) - tr.dir * tr.swirl * (1 - e), r = Math.hypot(dx, dy) * e;
          x = C.x + Math.cos(a) * r; y = C.y + Math.sin(a) * r; s *= e;
        } else {
          x = tr.from.x + (x - tr.from.x) * e; y = tr.from.y + (y - tr.from.y) * e; s = tr.from.s + (s - tr.from.s) * e;
        }
      }
    }
    b.at.x = x; b.at.y = y; b.at.s = s;
    b.sx(x); b.sy(y); b.ss(Math.max(0, s));
    if (done && tr.done) tr.done(b);
  }

  /* a ring with a queue swaps words as each slot passes the gate: turning the ring's own way pushes
     the old word to the back of the queue and takes the front; turning back undoes it */
  function stream(R, now) {
    for (let j = 0; j < R.S; j++) {
      const L = Math.floor((R.theta + j * R.step - GATE) / TAU);
      let d = (L - R.lap[j]) * R.dir;
      if (!d) continue;
      R.lap[j] = L;
      const b = R.slots[j];
      if (!b || b.sticky || b.hold || b.tr) continue;
      let id = b.id;
      for (; d > 0; d--) { R.queue.push(id); id = R.queue.shift(); }
      for (; d < 0; d++) { R.queue.unshift(id); id = R.queue.pop(); }
      if (id === b.id) continue;
      bodies.delete(b.id); FW.dispose(b.el);
      place(make(id, R, j), now);
    }
  }

  function tick(time, dtMs) {
    const dt = Math.min(dtMs / 1000, 0.05), now = gsap.ticker.time;
    if (on) {
      const a = 1 - Math.exp(-dt * 8);
      C.x += (G.x - C.x) * a; C.y += (G.y - C.y) * a; C.s += (G.s - C.s) * a;
      rings.forEach(R => {
        R.rx += (R.tx - R.rx) * a; R.ry += (R.ty - R.ry) * a; R.sc += (R.ts - R.sc) * a;
        if (!R.held) { R.w += (R.w0 - R.w) * (1 - Math.exp(-dt / 1.2)); R.theta += R.w * dt; }
        if (R.queue.length && !closing) stream(R, now);
      });
    }
    bodies.forEach(b => place(b, now));
    dying.forEach(b => place(b, now));
  }
  const start = () => { if (!ticking) { ticking = true; gsap.ticker.add(tick); } };
  const idle = () => { if (!on && !dying.size && ticking) { ticking = false; gsap.ticker.remove(tick); } };

  /* ---------- gestures ---------- */
  const live = b => on && !closing && bodies.get(b.id) === b;
  const hand = b => ({
    onDown: () => { if (!live(b)) return; b.hold = true; if (b.where === 'ring') { b.heldR = b.R; b.R.held++; } },
    onEnd: () => { b.hold = false; if (b.heldR) { b.heldR.held = Math.max(0, b.heldR.held - 1); b.heldR = null; } },
    onTap: () => live(b) && tap(b),
    onLong: () => live(b) && FW.pin(b.id, b.el),
    onDrag: (dx, dy, e) => { if (!live(b)) return; if (b.where === 'ring') spin(b.R, e); else gsap.set(b.el.querySelector('.grip'), { x: dx * 0.6, y: dy * 0.6 }); },
    onRelease: (dx, dy, vx, vy) => {
      if (b.where === 'ring' || drag) return letGo();
      if (live(b) && ((vy > 0.6 && dy > 30) || dy > 140)) FW.pin(b.id, b.el);
      const m = T.motion('spring-back');
      gsap.to(b.el.querySelector('.grip'), { x: 0, y: 0, duration: FW.dur(m.dur), ease: m.ease });
    }
  });

  function spin(R, e) {
    const now = performance.now();
    if (!drag || drag.R !== R) fr = FW.els.frame.getBoundingClientRect();
    const a = Math.atan2(e.clientY - fr.top - C.y, e.clientX - fr.left - C.x);
    if (!drag || drag.R !== R) { if (drag) letGo(); drag = { R, a, t: now, w: 0 }; R.held++; return; }
    const da = wrapS(a - drag.a), dt = Math.max(8, now - drag.t) / 1000;
    R.theta += da;
    drag.w = drag.w * 0.5 + da / dt * 0.5;
    drag.a = a; drag.t = now;
  }
  function letGo() {
    if (!drag) return;
    const R = drag.R;
    R.w = performance.now() - drag.t > 90 ? 0 : clamp(drag.w, -6, 6);
    R.held = Math.max(0, R.held - 1);
    drag = null;
  }

  function tap(b) {
    if (b !== mid) return swap(b);
    if (b.id === headId) return close();
    const h = bodies.get(headId);
    if (h) swap(h);
  }

  /* the tapped word takes the middle and the word that was there takes its place on the ring */
  function swap(b) {
    const m = mid;
    if (!m || b === m || b.where !== 'ring') return;
    const R = b.R, j = b.j, sw = T.motion('synonyms-swap');
    move(m, 'ring', R, j, sw);
    move(b, 'mid', null, 0, sw);
    R.slots[j] = m; mid = b;
    style(m); style(b);
    FW.peek(b.id); FW.tint(b.f.avg);
    targets();
  }

  /* empty space: a drag spins whichever ring is under the finger; a tap near a moon picks it,
     and a tap anywhere else folds the words away */
  const local = e => { fr = FW.els.frame.getBoundingClientRect(); return { x: e.clientX - fr.left, y: e.clientY - fr.top }; };
  const ringAt = p => {
    const a = Math.atan2(p.y - C.y, p.x - C.x), d = Math.hypot(p.x - C.x, p.y - C.y);
    return rings.reduce((best, R) => !best || Math.abs(d / rad(R, a) - 1) < Math.abs(d / rad(best, a) - 1) ? R : best, null);
  };
  const near = p => {
    let best = null, bd = 14;
    bodies.forEach(b => { const d = Math.hypot(b.at.x - p.x, b.at.y - p.y) - B * b.at.s / 2; if (d < bd) { bd = d; best = b; } });
    return best;
  };
  stage.addEventListener('pointerdown', e => {
    if (!on || closing || e.button > 0 || e.target.closest('.node')) return;
    const p = local(e);
    bg = { x: e.clientX, y: e.clientY, p, moved: false, R: ringAt(p) };
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  });
  stage.addEventListener('pointermove', e => {
    if (!bg) return;
    if (!bg.moved && Math.hypot(e.clientX - bg.x, e.clientY - bg.y) > 9) bg.moved = true;
    if (bg.moved && bg.R && on && !closing) spin(bg.R, e);
  });
  const bgEnd = e => {
    if (!bg) return;
    const g = bg; bg = null;
    if (g.moved) return letGo();
    if (e.type !== 'pointerup' || !on || closing) return;
    const n = near(g.p);
    n ? tap(n) : close();
  };
  stage.addEventListener('pointerup', bgEnd);
  stage.addEventListener('pointercancel', bgEnd);

  /* ---------- open / close ---------- */
  function open(id, el, at) {
    if (on || !el || !FW.words(id).length) return false;
    on = true; closing = false; headId = id; mid = null; drag = null;
    FW.wordsOpen = true;
    stage.classList.add('orbiting');
    /* the peek card first: its height decides how much room the rings get */
    const first = at && at !== id && FW.byId[at] && FW.byId[at].head === id ? at : null;
    FW.peek(first || id); FW.tint(FW.byId[first || id].avg);
    build(first);
    const now = gsap.ticker.time, op = T.motion('synonyms-open'), sw = T.motion('synonyms-swap');
    const ease = gsap.parseEase(op.ease), swirl = (op.swirl ?? 35) * Math.PI / 180, stag = op.stagger ?? 0.028;
    const most = Math.max(...rings.map(R => R.S));
    /* the feeling itself stays bloom's own bubble, borrowed for as long as the orbit is open */
    gsap.killTweensOf(el, 'x,y,scale,opacity');
    gsap.set(el, { opacity: 1 });
    const h = body(id, el, null, 0);
    rings.forEach(R => R.ids.slice(0, R.S).forEach((wid, j) => {
      if (wid === id) { R.slots[j] = h; move(h, 'ring', R, j, sw); return; }
      /* both rings unfurl from the top, each in the direction it turns */
      const n = R.dir > 0 ? j : R.S - 1 - j;
      make(wid, R, j).tr = { kind: 'enter', t0: now + FW.dur(0.06 + n / R.S * stag * most), dur: FW.dur(op.dur), ease, dir: R.dir, swirl };
    }));
    if (h.where === 'ring') { mid = make(first, null, 0); mid.tr = { kind: 'enter', t0: now, dur: FW.dur(op.dur), ease, dir: 1, swirl: 0 }; }
    else { mid = h; move(h, 'mid', null, 0, sw); }
    bodies.forEach(style);
    start();
    return true;
  }

  function close(fast) {
    if (!on) return;
    /* already folding away: a fast close just finishes it now */
    if (closing) { if (fast) handBack(true); return; }
    closing = true;
    FW.wordsOpen = false;
    stage.classList.remove('orbiting');
    if (drag) letGo();
    bg = null;
    const cl = T.motion('synonyms-close'), now = gsap.ticker.time, ease = gsap.parseEase(cl.ease), h = bodies.get(headId);
    let i = 0;
    [...bodies.values()].filter(b => b !== h).forEach(b => {
      bodies.delete(b.id); dying.add(b);
      b.el.classList.add('off');
      b.where = 'out';
      b.tr = { kind: 'move', from: { ...b.at }, t0: now + (fast ? 0 : FW.dur(i++ * (cl.stagger ?? 0.012))), dur: FW.dur(fast ? 0.25 : cl.dur), ease,
        done: () => { dying.delete(b); FW.dispose(b.el); idle(); } };
    });
    FW.peek(headId);
    if (h) FW.tint(h.f.avg);
    if (fast || !h) return handBack(true);
    move(h, 'mid', null, 0, { dur: cl.dur, ease: 'power2.inOut' }, () => handBack(false));
  }

  function handBack(fast) {
    const id = headId, h = bodies.get(id);
    bodies.clear();
    on = false; closing = false; headId = null; mid = null; rings = [];
    if (h) { h.tr = null; h.el.classList.remove('is-head', 'moon'); }
    host.onClose(id, fast);
    idle();
  }

  /* bring a word to the middle — from a ring, or straight out of the queue */
  function center(id) {
    if (!on || closing) return;
    let b = bodies.get(id);
    if (!b) {
      const R = rings.find(x => x.queue.includes(id));
      if (!R) return;
      let j = -1, far = -1;
      R.slots.forEach((s, x) => { const d = Math.abs(wrapS(R.theta + x * R.step - GATE)); if (s && !s.sticky && !s.tr && d > far) { far = d; j = x; } });
      if (j < 0) return;
      const old = R.slots[j];
      R.queue[R.queue.indexOf(id)] = old.id;
      bodies.delete(old.id); FW.dispose(old.el);
      b = make(id, R, j);
      place(b, gsap.ticker.time);
    }
    if (b !== mid) swap(b);
  }

  return {
    open, close, center,
    relayout() { if (on && !closing) targets(); },
    syncPins() { bodies.forEach(b => b.el.classList.toggle('is-pinned', FW.isPinned(b.id))); },
    isOpen: () => on && !closing,
    owns: id => on && bodies.has(id),
    head: () => headId,
    hand: id => { const b = bodies.get(id); return b ? hand(b) : null; }
  };
}
