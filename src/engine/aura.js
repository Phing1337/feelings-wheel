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

/* ---------- OKLab / OKLCH, so colour shifts glide through clean hues ---------- */
const lin = c => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const enc = c => Math.round(255 * clamp(0, 1, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
const toLch = hex => {
  const [r, g, b] = FW.color.hex2rgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return { L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, C: Math.hypot(A, B), h: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
};
const toRgb = (L, C, h) => {
  const A = C * Math.cos(h * Math.PI / 180), B = C * Math.sin(h * Math.PI / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  return [enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    enc(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
};

/* ---------- the four glows, measured from Paper (390 × 844) ---------- */
// x/y: centre as a fraction of the frame · r: radius as a fraction of its height · o: opacity × the aura token
const HOME = [
  { x: 363.1 / 390, y: 78.6 / 844, r: 250 / 844, o: 1, fam: 'joyful' },          // top right
  { x: 7.1 / 390, y: 6.6 / 844, r: 336 / 844, o: 1, fam: 'peaceful' },           // top left
  { x: -38.4 / 390, y: 753.1 / 844, r: 510.5 / 844, o: 1, fam: 'sad' },          // bottom left
  { x: 269.1 / 390, y: 492.6 / 844, r: 558 / 844, o: 27 / 37, fam: 'haze' }      // centre: the mood haze (Paper: 27% vs 37%)
];
const VIS = [3, 2, 1, 0];                         // most visible first: centre, bottom, top left, top right
const VAL = { joyful: 1, powerful: 0.6, peaceful: 0.5, scared: -0.5, mad: -0.5, sad: -1 };
// a family filling several corners steps round the hue wheel (dimming a touch to stay in gamut) so it
// still reads as a rich gradient: yellow → gold → amber, deep red → crimson → wine, mint → teal.
// Never toward green: dim yellow-green turns olive on ink.
const STEP = { dh: 18, dL: -0.065 };
const LEAN = { peaceful: 1 };                     // everyone else leans toward red

const blobs = HOME.map(h => ({ ...h, dx: 0, dy: 0, s: 1, hs: 0, L: 0.5, C: 0, h: 0, a: 0 }));
const st = { k: 1 };
let frame, cv, ctx, W = 390, H = 844, theme = '', last = -1;

const pct = (name, d) => { const v = parseFloat(T.css(name)); return (Number.isFinite(v) ? v : d) / 100; };
const lch = (name, d) => toLch(FW.color.toHex(T.css('--fw-color-aura-' + name)) || d);
const palette = () => ({
  ...Object.fromEntries(FW.fams.map(F => [F.id, lch(F.id, F.color)])),
  haze: lch('haze', '#8C46CD'), 'haze-happy': lch('haze-happy', '#B69CFF'), 'haze-sad': lch('haze-sad', '#8F0100')
});
const mixLch = (a, b, t) => ({ L: a.L + (b.L - a.L) * t, C: a.C + (b.C - a.C) * t, h: a.h + (((b.h - a.h) % 360 + 540) % 360 - 180) * t });

/* which family each corner shows: your strongest feelings share the three corners by weight —
   light feelings high, heavy ones low, like light coming from above. The centre is always the haze. */
function plan(mix) {
  if (!mix.length) return { fams: HOME.map(b => b.fam), v: 0 };
  const top = mix.filter((m, i) => !i || m.w >= 0.1).slice(0, 3);
  const tot = top.reduce((s, m) => s + m.w, 0);
  const q = top.map(m => m.w / tot * 3), n = q.map(x => Math.max(1, Math.floor(x)));
  let extra = n.reduce((a, b) => a + b, 0) - 3;
  for (; extra > 0; extra--) n[n.indexOf(Math.max(...n))]--;
  for (; extra < 0; extra++) { let bi = 0; q.forEach((x, i) => { if (x - n[i] > q[bi] - n[bi]) bi = i; }); n[bi]++; }
  const fams = top.flatMap((m, i) => Array(n[i]).fill(m.fam)).sort((a, b) => VAL[b] - VAL[a]);
  fams[3] = 'haze';
  return { fams, v: mix.reduce((s, m) => s + m.w * (VAL[m.fam] || 0), 0) };
}

function targets({ fams, v }) {
  const pal = palette(), base = pct('--fw-opacity-aura', 37), mood = pct('--fw-opacity-aura-mood', 35);
  const k = 1 + mood * (v > 0 ? 1.5 * v : -0.5 * v);    // happy glows brighter, heavy grows denser…
  const dL = v < 0 ? mood * 0.1 * v : 0;                 // …and sinks deeper
  const haze = mixLch(pal.haze, pal[v > 0 ? 'haze-happy' : 'haze-sad'], Math.min(1, Math.abs(v)));
  const seen = {};
  return HOME.map((hm, i) => {
    const f = fams[i], c = f === 'haze' ? haze : pal[f] || pal[hm.fam];
    const n = f === 'haze' ? 0 : (seen[f] = (seen[f] ?? -1) + 1);      // 2nd / 3rd corner of one family: next shade
    return { L: clamp(0.25, 0.97, c.L + dL + n * STEP.dL), C: c.C, h: c.h + n * STEP.dh * (LEAN[f] || -1), a: Math.min(0.6, base * hm.o * k) };
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
function shift(instant) {
  const t = current(), m = T.motion('aura-shift');
  blobs.forEach((b, i) => {
    const dh = ((t[i].h - b.h) % 360 + 540) % 360 - 180;   // shortest way round the hue wheel
    gsap.to(b, { L: t[i].L, C: t[i].C, h: b.h + dh, a: t[i].a, overwrite: 'auto',
      duration: instant ? 0 : m.dur, delay: instant ? 0 : VIS.indexOf(i) * (m.stagger || 0), ease: m.ease });
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
  FW.aura = { shift, blobs, plan, current };
};
})();
