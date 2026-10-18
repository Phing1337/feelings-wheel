/* Reads the design tokens (src/tokens.css) at runtime.
   Motion: "0.8s · back.out(1.5) · stagger 35ms" -> { dur: 0.8, ease: 'back.out(1.5)', stagger: 0.035 }
   Layout: "116 × 128 · 0.7× · 7"                 -> [116, 128, 0.7, 7]
   Every value has a fallback, so a missing or mistyped token never breaks the app. */
const FW = window.FW = window.FW || {};

const FALLBACK = {
  'motion-bloom-in': '0.8s · back.out(1.5) · stagger 35ms',
  'motion-move': '0.75s · power3.inOut',
  'motion-exit': '0.45s · power2.in · drift 90px',
  'motion-pulse': '0.8s · elastic.out(1, 0.4) · from 1.12',
  'motion-spring-back': '0.9s · elastic.out(1, 0.45)',
  'motion-press': '0.18s · power2.out · scale 0.92',
  'motion-release': '0.6s · elastic.out(1, 0.45)',
  'motion-hold': '0.48s',
  'motion-pin-flight': '0.75s · power2.in · lift 0.16s',
  'motion-bump': '1s · elastic.out(1, 0.35) · from 1.2',
  'motion-peek-in': '0.45s · power3.out · rise 24px',
  'motion-drawer-open': '0.6s · power3.out',
  'motion-drawer-close': '0.45s · power2.in',
  'motion-toast': '0.3s · power2.out · hold 1.6s',
  'motion-pivot-slide': '0.45s · power3.out',
  'motion-float': '2.2–3.8s · sine.inOut · drift 3–6px',
  'motion-blend-spin': '16–28s · none',
  'motion-dock-spin': '24s · none',
  'motion-tint': '0.9s · power2.out',
  'motion-wheel-seg': '0.7s · power3.out',
  'motion-synonyms-open': '0.9s · back.out(1.3) · stagger 28ms · swirl 35°',
  'motion-synonyms-swap': '0.75s · power3.inOut',
  'motion-synonyms-close': '0.45s · power2.in · stagger 12ms',
  'motion-synonyms-revolve': '90–140s · none',
  'motion-aura-drift': '60–110s · sine.inOut · drift 18% · breathe 12% · shimmer 8°',
  'motion-aura-shift': '8s · sine.inOut · stagger 0.7s',
  'layout-center-y': '42%',
  'layout-max-zoom': '1.15×',
  'layout-bloom-home': 'radius 134 · 0.9×',
  'layout-bloom-focus': '1.2×',
  'layout-bloom-inner': '116 × 128 · 0.7× · 7',
  'layout-bloom-outer': '160 × 208 · 0.58× · 9',
  'layout-bloom-more': '55°',
  'layout-honeycomb-cell': '78',
  'layout-honeycomb-size': '0.66×',
  'layout-honeycomb-rings': '5',
  'layout-orbit-field': '150 × 250',
  'layout-orbit-focus': '1.1×',
  'layout-orbit-ring': '122 × 132 · 0.6×',
  'layout-orbit-rest': 'fade 40% · push 1.15×',
  'layout-synonyms-center': '1×',
  'layout-synonyms-inner': '90 × 92 · 0.6× · squeeze 12%',
  'layout-synonyms-outer': '160 × 160 · 0.56× · squeeze 22%'
};

const cache = new Map();
const nums = s => (String(s).match(/-?\d*\.?\d+/g) || []).map(Number);

const raw = key => {
  if (cache.has(key)) return cache.get(key);
  const v = getComputedStyle(document.documentElement).getPropertyValue('--fw-' + key).trim().replace(/^["']|["']$/g, '');
  cache.set(key, v || FALLBACK[key] || '');
  return cache.get(key);
};

const parseMotion = s => {
  const parts = s.split('·').map(p => p.trim()).filter(Boolean);
  const d = nums(parts[0]);
  const out = { dur: d[0] ?? 0.5, dur2: d[1] ?? d[0] ?? 0.5, ease: parts[1] || 'power2.out' };
  if (/ms\b/.test(parts[0] || '')) { out.dur /= 1000; out.dur2 /= 1000; }
  parts.slice(2).forEach(p => {
    const m = p.match(/^([a-z][a-z-]*)\s+(.+)$/i); if (!m) return;
    let v = nums(m[2]);
    if (/ms\b/.test(m[2])) v = v.map(x => x / 1000);
    out[m[1].toLowerCase()] = v.length > 1 ? v : v[0];
  });
  return out;
};

FW.tok = {
  raw,
  motion(name) {
    const key = 'motion-' + name;
    const m = parseMotion(raw(key));
    return Number.isFinite(m.dur) ? m : parseMotion(FALLBACK[key] || '0.5s');
  },
  layout(name) {
    const key = 'layout-' + name;
    const v = nums(raw(key));
    return v.length ? v : nums(FALLBACK[key] || '');
  },
  css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); },
  refresh() { cache.clear(); }
};
