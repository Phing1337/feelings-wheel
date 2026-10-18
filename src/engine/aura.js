/* Feelings wheel — aura: the slow, dreamy light behind the bubbles.
   Four soft glows (Paper · "Phone · Ink") drift on long, random GSAP legs. The three corner
   glows take the colours of the feelings on your wheel; the big centre haze carries the mood —
   violet at rest, lifting to a brighter lavender as you get happier, sinking to deep red as you
   get sadder. Drawn on a tiny canvas and stretched — the glows are all soft gradients, so it
   looks the same and costs almost nothing on a phone. */
(function () {
const FW = window.FW, T = FW.tok;
const rnd = gsap.utils.random, clamp = gsap.utils.clamp;
const SCALE = 4;       // css px per canvas px
const FPS = 30;        // the motion is so slow that 30fps is indistinguishable from 60

/* OKLab / OKLCH (core.js), so colour shifts glide through clean hues */
const toLch = FW.color.toLch, toRgb = FW.color.lchRgb;

/* ---------- the four glows, measured from Paper (390 × 844) ---------- */
// x/y: centre as a fraction of the frame · r: radius as a fraction of its height · o: opacity × the aura token.
// The three corners rest on the deck's aura.corners (feelings: joyful top right, peaceful top left, sad bottom left).
const HOME = [
  { x: 363.1 / 390, y: 78.6 / 844, r: 250 / 844, o: 1 },          // top right
  { x: 7.1 / 390, y: 6.6 / 844, r: 336 / 844, o: 1 },             // top left
  { x: -38.4 / 390, y: 753.1 / 844, r: 510.5 / 844, o: 1 },       // bottom left
  { x: 269.1 / 390, y: 492.6 / 844, r: 558 / 844, o: 27 / 37 }    // centre: the mood haze (Paper: 27% vs 37%)
];
const VIS = [3, 2, 1, 0];                         // most visible first: centre, bottom, top left, top right
// a family filling several corners steps round the hue wheel (dimming a touch to stay in gamut) so it
// still reads as a rich gradient: yellow → gold → amber, deep red → crimson → wine, mint → teal.
// Never toward green: dim yellow-green turns olive on ink. Families in the deck's aura.lean step the
// other way; everyone else leans toward red.
const STEP = { dh: 18, dL: -0.065 };

const blobs = HOME.map(h => ({ ...h, dx: 0, dy: 0, s: 1, hs: 0, L: 0.5, C: 0, h: 0, a: 0 }));
const st = { k: 1 };
let frame, cv, ctx, W = 390, H = 844, theme = '', last = -1;

const pct = (name, d) => { const v = parseFloat(T.css(name)); return (Number.isFinite(v) ? v : d) / 100; };
const lch = (name, d) => toLch(FW.color.toHex(T.css('--fw-color-aura-' + name)) || d);
const palette = () => ({
  ...Object.fromEntries(FW.fams.map(F => [F.id, toLch(FW.color.toHex(T.css(`--fw-color-aura-${FW.deck.id}-${F.id}`)) || FW.color.toHex(T.css('--fw-color-aura-' + F.id)) || F.color)])),
  haze: lch('haze', '#8C46CD'), 'haze-happy': lch('haze-happy', '#B69CFF'), 'haze-sad': lch('haze-sad', '#8F0100')
});
const mixLch = (a, b, t) => ({ L: a.L + (b.L - a.L) * t, C: a.C + (b.C - a.C) * t, h: a.h + (((b.h - a.h) % 360 + 540) % 360 - 180) * t });

/* which family each corner shows: your strongest pins share the three corners by weight —
   the deck's brightest families high, heavy ones low, like light coming from above. The centre is
   always the haze, and its mood (-1 heavy … +1 bright) comes from the deck. */
function plan(mix) {
  const A = FW.UI.aura;
  if (!mix.length) return { fams: [...A.corners, 'haze'], v: 0 };
  const top = mix.filter((m, i) => !i || m.w >= 0.1).slice(0, 3);
  const tot = top.reduce((s, m) => s + m.w, 0);
  const q = top.map(m => m.w / tot * 3), n = q.map(x => Math.max(1, Math.floor(x)));
  let extra = n.reduce((a, b) => a + b, 0) - 3;
  for (; extra > 0; extra--) n[n.indexOf(Math.max(...n))]--;
  for (; extra < 0; extra++) { let bi = 0; q.forEach((x, i) => { if (x - n[i] > q[bi] - n[bi]) bi = i; }); n[bi]++; }
  const fams = top.flatMap((m, i) => Array(n[i]).fill(m.fam)).sort((a, b) => (A.rank[b] || 0) - (A.rank[a] || 0));
  fams[3] = 'haze';
  return { fams, v: clamp(-1, 1, A.mood(mix)) };
}

function targets({ fams, v }) {
  const A = FW.UI.aura, pal = palette(), base = pct('--fw-opacity-aura', 37), mood = pct('--fw-opacity-aura-mood', 35);
  const k = 1 + mood * (v > 0 ? 1.5 * v : -0.5 * v);    // happy glows brighter, heavy grows denser…
  const dL = v < 0 ? mood * 0.1 * v : 0;                 // …and sinks deeper
  const haze = mixLch(pal.haze, pal[v > 0 ? 'haze-happy' : 'haze-sad'], Math.min(1, Math.abs(v)));
  const seen = {};
  return HOME.map((hm, i) => {
    const f = fams[i], c = f === 'haze' ? haze : pal[f] || pal[A.corners[i]] || haze;
    const n = f === 'haze' ? 0 : (seen[f] = (seen[f] ?? -1) + 1);      // 2nd / 3rd corner of one family: next shade
    return { L: clamp(0.25, 0.97, c.L + dL + n * STEP.dL), C: c.C, h: c.h + n * STEP.dh * (A.lean[f] || -1), a: Math.min(0.6, base * hm.o * k) };
  });
}
const current = () => targets(plan(FW.pins.length ? FW.aggregate() : []));

/* ---------- motion: long, random, overlapping legs so it never visibly loops ---------- */
function wander(b) {
  const m = T.motion('aura-drift'), d = (m.drift ?? 18) / 100;
  gsap.to(b, { dx: rnd(-d, d), dy: rnd(-d, d) * 0.7, duration: rnd(m.dur, m.dur2), ease: m.ease, onComplete: wander, onCompleteParams: [b] });
}
function breathe(b) {
  const m = T.motion('aura-drift'), br = (m.breathe ?? 12) / 100, sh = m.shimmer ?? 8;
  gsap.to(b, { s: 1 + rnd(-br, br), hs: rnd(-sh, sh), duration: rnd(m.dur, m.dur2) * 0.7, ease: m.ease, onComplete: breathe, onCompleteParams: [b] });
}
function shift(instant, k = 1) {
  const t = current(), m = T.motion('aura-shift');
  blobs.forEach((b, i) => {
    const dh = ((t[i].h - b.h) % 360 + 540) % 360 - 180;   // shortest way round the hue wheel
    gsap.to(b, { L: t[i].L, C: t[i].C, h: b.h + dh, a: t[i].a, overwrite: 'auto',
      duration: instant ? 0 : m.dur * k, delay: instant ? 0 : VIS.indexOf(i) * (m.stagger || 0) * k, ease: m.ease });
  });
}

function fit() {
  W = frame.clientWidth || W; H = frame.clientHeight || H;
  cv.width = Math.max(8, Math.ceil(W / SCALE)); cv.height = Math.max(8, Math.ceil(H / SCALE));
  last = -1;
}

function draw(time) {
  const th = frame.dataset.theme;
  if (th !== theme) {
    gsap.to(st, { k: th === 'poster' ? pct('--fw-opacity-aura-poster', 45) : 1, duration: theme ? 0.5 : 0, overwrite: true });
    theme = th;
  }
  if (last >= 0 && time - last < 1 / FPS) return;
  last = time;
  const w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  for (const b of blobs) {
    const a = b.a * st.k; if (a < 0.004) continue;
    const x = (b.x + b.dx) * w, y = (b.y + b.dy) * h, r = b.r * b.s * h;
    const [R, G, B] = toRgb(b.L, b.C, b.h + b.hs);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${R},${G},${B},${a.toFixed(3)})`);
    g.addColorStop(1, `rgba(${R},${G},${B},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

FW.initAura = () => {
  if (FW.aura) return;
  frame = FW.els.frame; cv = FW.els.aura; ctx = cv.getContext('2d');
  shift(true);
  fit();
  new ResizeObserver(fit).observe(frame);
  if (!FW.reduce) blobs.forEach(b => { wander(b); breathe(b); });
  gsap.ticker.add(draw);
  FW.on('pins', () => shift(false));
  FW.on('deck', () => shift(false, 0.35));     // a new deck re-lights the room quicker than a new pin
  FW.aura = { shift, blobs, plan, current };
};
})();
