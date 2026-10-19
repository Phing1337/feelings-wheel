/* Decks — what the app says around each deck's words: the "I feel | I see you" switch, the prompt,
   the drawer, sharing, the journal and the aura's mood. The words themselves are
   YAML (content/ for feelings, content/people/ for people); FW.useDeck (core.js) swaps a deck in and
   points FW.UI at its entry here. */
(function () {
const FW = window.FW = window.FW || {};

/* an older build kept a person's name on this device for its message builder — forget it */
try { localStorage.removeItem('fw.people.name'); } catch (e) {}

const join = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const an = w => /^[aeiou]/i.test(w) ? 'an' : 'a';
const bit = w => /^an?\s/i.test(w) ? 'kind of ' + w : 'a bit ' + w;
const pinned = () => FW.pinnedSorted().map(p => FW.byId[p.id]).filter(Boolean);
const example = (id, tags) => {
  const ex = FW.content(id).examples || [];
  for (const t of tags) { const e = ex.find(x => x.tag === t); if (e) return e.s; }
  return '';
};

const VAL = { joyful: 1, powerful: 0.6, peaceful: 0.5, scared: -0.5, mad: -0.5, sad: -1 };
const SIDE_MOOD = { light: 0.7, edge: -0.2, shadow: -0.9 };

FW.UIS = {
  feelings: {
    tab: 'I feel',
    prompt: 'How are you<br>feeling?',
    hint: 'tap to explore<br>hold to pin',
    pins: 'fw.pins.v1',
    dock: () => 'my wheel',
    title: () => 'How I’m feeling',
    empty: 'Nothing pinned yet.<br>Hold a bubble — or flick it down — to pin how you feel.',
    sides: {},
    fields: [{ key: 'body', lead: 'In your body: ' }, { key: 'voice', quote: true }],
    /* search (search.js): ways in for when you can't name it yet */
    search: { describe: 'Or describe it', try: ['feeling down', 'too much', 'nobody gets me', 'lump in my throat', 'can’t stop smiling', 'proud of myself'] },
    summary(agg) {
      const bits = agg.filter(p => p.w >= 0.08).map(p => (p.w >= 0.45 ? 'mostly ' : p.w >= 0.2 ? 'some ' : 'a little ') + FW.fam[p.fam].name.toLowerCase());
      return bits.length ? cap(bits.join(' · ')) : 'Nothing pinned yet';
    },
    share(f) {
      return (!f.head && example(f.id, ['text'])) || `Feeling ${f.word} right now${f.head ? ' — ' : '. '}${f.def}`;
    },
    shareTitle: () => 'How I’m feeling',
    /* the three corner glows rest on these families; your feelings take them over, the brightest
       highest, and the centre haze follows the mood */
    aura: {
      corners: ['joyful', 'peaceful', 'sad'],
      rank: VAL,
      lean: { peaceful: 1 },
      mood: agg => agg.reduce((s, m) => s + m.w * (VAL[m.fam] || 0), 0)
    }
  },

  /* "I see you": words for the people in your life — what you love about them, and (honestly) the
     double-edged and shadow sides too. */
  people: {
    tab: 'I see you',
    prompt: 'How do you<br>see them?',
    hint: 'tap to explore<br>hold to pin',
    pins: 'fw.pins.people.v1',
    dock: () => 'their wheel',
    title: () => 'How I see them',
    empty: 'Nothing pinned yet.<br>Hold a bubble — or flick it down — to pin what you see in them.',
    sides: { edge: 'double-edged', shadow: 'shadow side' },
    fields: [{ key: 'notice', lead: 'You see it in ', dot: true }],
    search: { describe: 'Or describe them', try: ['makes me laugh', 'beautiful smile', 'quick wit', 'big heart', 'good listener', 'thinks deeply'] },
    summary() {
      const ws = pinned();
      if (!ws.length) return 'Nothing pinned yet';
      const lit = ws.filter(f => f.side !== 'shadow').map(f => f.word), dim = ws.filter(f => f.side === 'shadow').map(f => f.word);
      const a = lit.length > 4 ? `${lit.slice(0, 4).join(', ')} + ${lit.length - 4} more` : join(lit);
      const b = dim.length ? `${an(dim[0])} ${join(dim.slice(0, 2))} streak` : '';
      return cap(a && b ? `${a} — with ${b}` : a || b);
    },
    share(f) {
      const tags = f.side === 'shadow' ? ['gentle'] : f.side === 'edge' ? ['text', 'gentle', 'say'] : ['text', 'say'];
      const ex = !f.head && example(f.id, tags);
      if (ex) return ex;
      if (f.side === 'shadow') return `Can I be honest? Sometimes you come across as ${bit(f.word)}.`;
      return `I think you’re ${f.word}${f.deep && f.def ? ` — it means ${f.def.replace(/[.\s]+$/, '')}` : ''}.`;
    },
    shareTitle: () => 'How I see you',
    /* warm words lift the haze, shadow-side words sink it toward red */
    aura: {
      corners: ['heart', 'mind', 'character'],
      rank: { humor: 6, heart: 5, spirit: 4, looks: 3, mind: 2, character: 1 },
      lean: { mind: 1, character: 1 },
      mood() {
        let s = 0, t = 0;
        FW.pins.forEach(p => { const f = FW.byId[p.id]; if (!f) return; s += SIDE_MOOD[f.side] ?? 0; t++; });
        return t ? s / t : 0;
      }
    }
  }
};

/* ---------- the mode switch: "I feel | I see you", at the bottom of the home screen ---------- */
FW.initModes = () => {
  const el = FW.els.modes;
  const ids = Object.keys(window.FW_DECKS || {}).filter(id => FW.UIS[id]);
  if (ids.length < 2) { el.style.display = 'none'; return; }
  el.innerHTML = '<i class="thumb"></i>' + ids.map(id => {
    const cols = FW.deckColors(id);
    return `<button role="tab" data-deck="${id}"><b class="mdot" style="background:conic-gradient(${cols.join(',')},${cols[0]})"></b>${FW.esc(FW.UIS[id].tab)}</button>`;
  }).join('');
  el.addEventListener('click', e => { const b = e.target.closest('button[data-deck]'); if (b) FW.emit('mode', b.dataset.deck); });
  FW.syncModes(true);
};
FW.syncModes = instant => {
  const el = FW.els && FW.els.modes, on = el && el.querySelector(`[data-deck="${FW.deck.id}"]`);
  if (!on) return;
  el.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b === on); b.setAttribute('aria-selected', b === on); });
  const m = FW.tok.motion('pivot-slide');
  gsap.to(el.querySelector('.thumb'), { x: on.offsetLeft, width: on.offsetWidth, duration: instant ? 0 : FW.dur(m.dur), ease: m.ease, overwrite: true });
};
/* home only: it steps aside for the trail + peek card while you explore, and comes back once the
   peek card has folded away (so the bottom of the screen never jumps) */
let modesOn = true, modesT = null;
FW.showModes = on => {
  const el = FW.els && FW.els.modes;
  if (!el || !el.children.length || on === modesOn) return;
  modesOn = on;
  if (modesT) { modesT.kill(); modesT = null; }
  gsap.killTweensOf(el);
  if (!on) { el.style.display = 'none'; return; }
  modesT = gsap.delayedCall(FW.dur(0.3), () => {
    modesT = null;
    el.style.display = '';
    FW.syncModes(true);
    gsap.fromTo(el, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: FW.dur(0.5), ease: 'power3.out' });
  });
};
})();
