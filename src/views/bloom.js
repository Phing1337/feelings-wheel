/* Bloom — tap a feeling and its relatives bloom around it. Tap the feeling in the middle again and
   its words orbit it (see orbit.js). Sizes, radii and timing come from the --fw-layout-bloom-* and
   --fw-motion-* tokens. */
import { createOrbit } from './orbit.js';

const FW = window.FW;

export function createBloom(stage) {
  const T = FW.tok, B = 100, MORE = '__more';
  const live = new Map();
  let focus = null, trail = [], page = 0, swap = 0, pillH = 0;
  let W, H, k, cx, cy, hy, top, bottom;

  const prompt = document.createElement('div');
  prompt.className = 'prompt';
  const promptHTML = () => `${FW.UI.prompt}<small>${FW.UI.hint}</small>`;
  prompt.innerHTML = promptHTML();
  stage.appendChild(prompt);

  function measure() {
    W = FW.W; H = FW.H;
    k = Math.min(W / 390, H / 844, T.layout('max-zoom')[0] ?? 1.15);
    /* home keeps room for the "I feel | I see you" switch (remembered while it's tucked away) */
    const md = FW.els.modes;
    if (md && md.style.display !== 'none' && md.offsetHeight) pillH = md.offsetHeight + 10;
    top = FW.room().top; bottom = 24 + FW.safe.bottom + pillH;
    cx = W / 2;
    cy = FW.safe.top + (H - FW.safe.top - FW.safe.bottom) * (T.layout('center-y')[0] ?? 42) / 100;
    /* home has nothing at the bottom, so its ring sits in the middle of the open space (a touch high) */
    hy = (top + H - bottom) / 2 - H * 0.03;
    prompt.style.top = (hy - 27) + 'px';
  }
  measure();

  /* when the words fold away, the feeling's relatives bloom back around it */
  const orbit = createOrbit(stage, {
    onClose(id, fast) { if (!fast && focus === id) render(focusLayout(id), { x: cx, y: cy }); }
  });

  const homeLayout = () => {
    const [rad = 134, sc = 0.9] = T.layout('bloom-home');
    return FW.fams.filter(F => FW.core[F.id]).map(F => ({ id: FW.core[F.id].id, x: cx + Math.cos(F.rad) * rad * k, y: hy + Math.sin(F.rad) * rad * k, sc: sc * k, cap: '', role: 'home' }));
  };

  /* place items on an ellipse, rotated so each sits as close as possible to its colour direction.
     An item with a `fixed` angle (the "more" bubble) pins the ring's rotation so it never moves. */
  function ring(items, rx, ry, f0, role, sc) {
    const m = items.length; if (!m) return [];
    const P0 = FW.pos(f0), TAU = 2 * Math.PI, wrap = a => ((a % TAU) + TAU) % TAU;
    const pref = items.map(it => {
      if (it.fixed != null) return it.fixed;
      const g = FW.byId[it.id], p = FW.pos(g);
      return Math.hypot(p.x - P0.x, p.y - P0.y) < 0.02 ? FW.fam[g.dom].rad : Math.atan2(p.y - P0.y, p.x - P0.x);
    });
    const step = TAU / m, pin = items.findIndex(it => it.fixed != null);
    let order, off;
    if (pin >= 0) {
      off = pref[pin];
      order = [pin, ...items.map((_, i) => i).filter(i => i !== pin).sort((a, b) => wrap(pref[a] - off) - wrap(pref[b] - off))];
    } else {
      order = items.map((_, i) => i).sort((a, b) => pref[a] - pref[b]);
      let sx = 0, sy = 0;
      order.forEach((idx, j) => { const d = pref[idx] - j * step; sx += Math.cos(d); sy += Math.sin(d); });
      off = Math.atan2(sy, sx);
    }
    return order.map((idx, j) => { const a = off + j * step, it = items[idx]; return { ...it, x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, role: it.more ? 'more' : role, sc }; });
  }

  /* nudge overlapping bubbles apart and keep them inside the safe band between top bar and peek card.
     The focus and the "more" bubble stay put; everything else makes room around them. */
  function relax(nodes) {
    const r = n => n.sc * B / 2, still = n => n.role === 'focus' || n.role === 'more';
    const clamp = n => { const rr = r(n); n.x = Math.max(rr + 6, Math.min(W - rr - 6, n.x)); n.y = Math.max(top + rr, Math.min(H - bottom - rr, n.y)); };
    nodes.forEach(n => { if (n.role === 'more') clamp(n); });
    for (let it = 0; it < 40; it++) {
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j], sa = still(a), sb = still(b);
        if (sa && sb) continue;
        let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01, min = r(a) + r(b) + (a.cap || b.cap ? 18 : 8) * k;
        if (d >= min) continue;
        const push = min - d; dx /= d; dy /= d;
        if (sa) { b.x += dx * push; b.y += dy * push; }
        else if (sb) { a.x -= dx * push; a.y -= dy * push; }
        else { a.x -= dx * push / 2; a.y -= dy * push / 2; b.x += dx * push / 2; b.y += dy * push / 2; }
      }
      nodes.forEach(n => { if (!still(n)) clamp(n); });
    }
    return nodes;
  }

  /* keep bubbles (and their captions) clear of the trail + peek card at the bottom, whose height
     depends on the definition */
  function band() {
    bottom = H - FW.room().bottom + 6;
  }

  /* relatives come best-first; when there are more than fit, the last outer slot becomes "+N more" */
  function focusLayout(id) {
    const f = FW.byId[id], rel = FW.related(id);
    const [fs = 1.2] = T.layout('bloom-focus');
    const [irx = 116, iry = 128, isc = 0.7, inN = 7] = T.layout('bloom-inner');
    const [orx = 160, ory = 208, osc = 0.58, outN = 9] = T.layout('bloom-outer');
    const [moreAt = 55] = T.layout('bloom-more');
    const fits = inN + outN, per = rel.length > fits ? fits - 1 : fits;
    const pages = Math.max(1, Math.ceil(rel.length / per));
    page = ((page % pages) + pages) % pages;
    const items = rel.slice(page * per, page * per + per);
    const outer = items.slice(inN);
    if (pages > 1) {
      const left = rel.length - (page + 1) * per;
      outer.push({ id: MORE, more: true, fixed: moreAt * Math.PI / 180, label: left > 0 ? '+' + left : '↺', cap: left > 0 ? 'more' : 'start over' });
    }
    band();
    const n = FW.words(id).length;
    return relax([{ id, x: cx, y: cy, sc: fs * k, cap: n ? `\u2248 ${n} words` : '', role: 'focus' },
      ...ring(items.slice(0, inN), irx * k, iry * k, f, 'inner', isc * k),
      ...ring(outer, orx * k, ory * k, f, 'outer', osc * k)]);
  }

  function turn() {
    if (!focus) return;
    page++;
    const el = live.get(MORE);
    if (el) gsap.fromTo(el.querySelector('.label'), { rotation: -120, opacity: 0 }, { rotation: 0, opacity: 1, duration: FW.dur(0.6), ease: 'back.out(2)' });
    render(focusLayout(focus), { x: cx, y: cy });
  }

  function moreBubble() {
    const el = document.createElement('div');
    el.className = 'node more';
    el.dataset.id = MORE;
    el.style.setProperty('--s', B + 'px');
    el.innerHTML = '<div class="grip"><div class="float"><div class="bubble"><div class="label"></div></div><div class="cap"></div></div></div>';
    el._tw = [];
    return el;
  }

  /* while the orbit has borrowed a bubble, its gestures belong to the orbit */
  const handlers = id => {
    const o = () => orbit.owns(id) ? orbit.hand(id) : null;
    return {
      onDown: e => { const h = o(); h && h.onDown(e); },
      onEnd: e => { const h = o(); h && h.onEnd(e); },
      onTap: e => { const h = o(); if (h) return h.onTap(e); focus === id ? openWords(id) : go(id); },
      onLong: () => { const h = o(); if (h) return h.onLong(); FW.pin(id, live.get(id)); },
      onDrag: (dx, dy, e) => {
        const h = o(); if (h) return h.onDrag(dx, dy, e);
        if (focus === id) gsap.set(live.get(id).querySelector('.grip'), { x: dx * 0.6, y: dy * 0.6 });
      },
      onRelease: (dx, dy, vx, vy, e) => {
        const h = o(); if (h) return h.onRelease(dx, dy, vx, vy, e);
        const el = live.get(id); if (!el) return;
        if (focus === id && ((vy > 0.6 && dy > 30) || dy > 140)) FW.pin(id, el);
        const m = T.motion('spring-back');
        gsap.to(el.querySelector('.grip'), { x: 0, y: 0, duration: FW.dur(m.dur), ease: m.ease });
      }
    };
  };

  function pulse(id) {
    const g = live.get(id).querySelector('.grip'), m = T.motion('pulse');
    gsap.fromTo(g, { scale: m.from ?? 1.12 }, { scale: 1, duration: FW.dur(m.dur), ease: m.ease, overwrite: 'auto' });
    FW.peek(id);
  }

  /* tapping the feeling in the middle sends its relatives away and lets its words orbit it */
  const openWords = id => FW.words(id).length ? words(id) : pulse(id);

  /* go to a feeling's words (optionally straight to one word): the feeling takes the middle,
     everything else drifts off, and the orbit borrows its bubble */
  function words(head, at) {
    if (orbit.isOpen() && orbit.head() === head) return at ? orbit.center(at) : orbit.close();
    FW.showModes(false);
    orbit.close(true);
    if (head !== focus) {
      page = 0; focus = head;
      const t = trail.indexOf(head); trail = t >= 0 ? trail.slice(0, t + 1) : [...trail, head];
      gsap.to(prompt, { autoAlpha: 0, scale: 0.9, duration: FW.dur(0.3) });
      drawTrail();
    }
    if (live.get(head)) exitExcept(new Set([head]));
    else render([{ id: head, x: cx, y: cy, sc: (T.layout('bloom-focus')[0] ?? 1.2) * k, cap: '', role: 'focus' }], { x: cx, y: cy });
    orbit.open(head, live.get(head), at);
  }

  function exitExcept(keep) {
    const ex = T.motion('exit');
    live.forEach((el, id) => {
      if (keep.has(id)) return;
      live.delete(id);
      el.classList.add('off');
      const x = gsap.getProperty(el, 'x'), y = gsap.getProperty(el, 'y'), a = Math.atan2(y - cy, x - cx), d = ex.drift ?? 90;
      gsap.to(el, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, scale: 0, opacity: 0, duration: FW.dur(ex.dur), ease: ex.ease, overwrite: true, onComplete: () => FW.dispose(el) });
    });
  }

  function render(nodes, origin) {
    const bi = T.motion('bloom-in'), mv = T.motion('move');
    exitExcept(new Set(nodes.map(n => n.id)));
    let i = 0;
    nodes.forEach(n => {
      let el = live.get(n.id);
      const fresh = !el;
      if (fresh) {
        el = n.more ? moreBubble() : FW.bubble(FW.byId[n.id], { size: B });
        stage.appendChild(el); live.set(n.id, el); FW.press(el, n.more ? { onTap: turn } : handlers(n.id));
        gsap.set(el, { x: origin.x, y: origin.y, scale: 0 });
      }
      if (n.more) el.querySelector('.label').textContent = n.label;
      el.classList.toggle('is-focus', n.role === 'focus');
      el.classList.toggle('is-pinned', FW.isPinned(n.id));
      el.style.zIndex = { focus: 4, inner: 3, home: 3, outer: 2, more: 3 }[n.role];
      const cap = el.querySelector('.cap');
      cap.textContent = n.cap || '';
      cap.style.fontSize = (10 / n.sc) + 'px';
      cap.style.marginTop = (5 / n.sc) + 'px';
      if (fresh) gsap.to(el, { x: n.x, y: n.y, scale: n.sc, duration: FW.dur(bi.dur), ease: bi.ease, delay: FW.dur(0.1 + i++ * (bi.stagger ?? 0.035)) });
      else gsap.to(el, { x: n.x, y: n.y, scale: n.sc, opacity: 1, duration: FW.dur(mv.dur), ease: mv.ease, overwrite: 'auto' });
    });
  }

  function go(id, fromTrail) {
    const w = id && FW.byId[id];
    if (w && w.head) return words(w.head, id);
    FW.showModes(!id);     // before the peek + band measure the hud
    orbit.close(true);
    const src = id && live.get(id);
    const origin = src ? { x: gsap.getProperty(src, 'x'), y: gsap.getProperty(src, 'y') } : { x: cx, y: cy };
    if ((id || null) !== focus) page = 0;
    focus = id || null;
    if (!id) {
      trail = [];
      FW.peek(null); FW.tint(null);
      drawTrail(); band();
      render(homeLayout(), origin);
      gsap.to(prompt, { autoAlpha: 1, scale: 1, duration: FW.dur(0.5), delay: FW.dur(0.25) });
    } else {
      if (!fromTrail) { const t = trail.indexOf(id); trail = t >= 0 ? trail.slice(0, t + 1) : [...trail, id]; }
      gsap.to(prompt, { autoAlpha: 0, scale: 0.9, duration: FW.dur(0.3) });
      FW.peek(id); FW.tint(FW.byId[id].avg);
      drawTrail();
      render(focusLayout(id), origin);
    }
  }

  /* breadcrumbs above the peek card: "◎ all › joyful › ecstatic". Hidden at home. */
  function drawTrail() {
    const t = FW.els.trail;
    t.innerHTML = '';
    if (!trail.length) { t.classList.remove('over'); return; }
    const home = document.createElement('button');
    home.className = 'chip'; home.textContent = '◎ all'; home.onclick = () => go(null);
    t.appendChild(home);
    trail.forEach((id, i) => {
      const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = '›'; t.appendChild(sep);
      const f = FW.byId[id], b = document.createElement('button');
      b.className = 'chip'; b.innerHTML = `<i style="background:${FW.fillCSS(f)}"></i>${FW.esc(f.word)}`;
      b.onclick = () => { trail = trail.slice(0, i + 1); go(id, true); };
      t.appendChild(b);
    });
    t.scrollLeft = t.scrollWidth;
    t.classList.toggle('over', t.scrollWidth > t.clientWidth + 1);
    if (trail.length) gsap.from(t.lastElementChild, { opacity: 0, x: -8, duration: FW.dur(0.35) });
  }

  /* the peek card's "≈ N words" chip opens and closes the orbit; "↩ feeling" brings the feeling back */
  FW.on('peek', ({ act, id }) => {
    const f = FW.byId[id]; if (!f) return;
    if (act === 'words') return orbit.isOpen() ? orbit.close() : words(id);
    if (act === 'head' && f.head) orbit.isOpen() && orbit.head() === f.head ? orbit.center(f.head) : go(f.head);
  });

  /* switching "I feel | I see you": the old deck's bubbles swirl into the middle and fade while the
     new deck's six bloom out of it, and the question in the middle changes. Timing: --fw-motion-deck-swap.
     With `at` (a search pick from the other deck) it lands straight on that word instead. */
  function deck(id, at) {
    if (!FW.setDeck(id)) return at && go(at);
    const n = ++swap, m = T.motion('deck-swap'), dur = FW.dur(m.dur ?? 0.6), sw = (m.swirl ?? 70) * Math.PI / 180;
    orbit.close(true);
    focus = null; trail = []; page = 0;
    FW.peek(null); FW.tint(null); drawTrail(); FW.syncModes();
    live.forEach((el, nid) => {
      live.delete(nid);
      gsap.killTweensOf(el);
      el.classList.add('off');
      const x = gsap.getProperty(el, 'x'), y = gsap.getProperty(el, 'y');
      const p = { a: Math.atan2(y - hy, x - cx), r: Math.hypot(x - cx, y - hy) };
      (el._tw = el._tw || []).push(gsap.to(p, { a: p.a + sw, r: p.r * 0.35, duration: dur, ease: m.ease,
        onUpdate: () => gsap.set(el, { x: cx + Math.cos(p.a) * p.r, y: hy + Math.sin(p.a) * p.r }) }));
      gsap.to(el, { scale: 0, opacity: 0, duration: dur, ease: m.ease, onComplete: () => FW.dispose(el) });
    });
    gsap.to(prompt, { autoAlpha: 0, scale: 0.92, duration: dur * 0.5, ease: 'power2.in', overwrite: true, onComplete: () => {
      if (n !== swap) return;
      prompt.innerHTML = promptHTML();
      if (!at) gsap.to(prompt, { autoAlpha: 1, scale: 1, duration: FW.dur(0.5), ease: 'back.out(1.6)' });
    } });
    gsap.delayedCall(dur * 0.55, () => n === swap && (at ? go(at) : render(homeLayout(), { x: cx, y: hy })));
  }

  return {
    go,
    deck,
    relayout() { measure(); if (orbit.isOpen()) orbit.relayout(); else go(focus, true); },
    syncPins() { live.forEach((el, id) => el.classList.toggle('is-pinned', FW.isPinned(id))); orbit.syncPins(); },
    focus: () => focus,
    live: () => [...live.keys()],
    orbit
  };
}
