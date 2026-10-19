/* Decks — what the app says around each deck's words: the "I feel | I see you" switch, the prompt,
   the drawer, sharing, the journal, the text builder and the aura's mood. The words themselves are
   YAML (content/ for feelings, content/people/ for people); FW.useDeck (core.js) swaps a deck in and
   points FW.UI at its entry here. */
(function () {
const FW = window.FW = window.FW || {};

/* the person's name is typed in the builder and only ever kept on this device */
const NAME = 'fw.people.name';
FW.person = () => { try { return (localStorage.getItem(NAME) || '').trim(); } catch (e) { return ''; } };
FW.setPerson = v => { try { localStorage.setItem(NAME, v.trim()); } catch (e) {} FW.emit('person', v.trim()); };

const join = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const clean = (s, lead) => (s || '').trim().replace(lead || /^$/, '').replace(/[.!\s]+$/, '');
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
    write: '✎ Write a text',
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
    },
    builder: {
      st: { tone: 'honest', len: 'quick', because: '', help: '' },
      controls: [
        ['seg', 'tone', [['light', 'Light'], ['honest', 'Honest'], ['tender', 'Tender']]],
        ['seg', 'len', [['quick', 'Quick'], ['fuller', 'Fuller']]],
        ['input', 'because', 'because… (optional)'],
        ['input', 'help', 'what would help… (optional)']
      ],
      empty: 'Pin a feeling or two first.',
      drafts(st) {
        const ws = pinned();
        if (!ws.length) return [];
        const words = ws.map(f => f.word), top = words.slice(0, 2);
        const why = clean(st.because, /^because\s+/i), help = clean(st.help);
        const helpLine = help ? ` What would help: ${help}.` : '';
        const fuller = st.len === 'fuller';
        const rest = words.slice(2, 5);
        const mix = fuller && rest.length ? ` There’s a bit of ${join(rest)} in there too.` : '';
        const T = {
          light: [`Hey — small heads up, I’m feeling a bit ${join(top)} today${why ? ` (${why})` : ''}.${mix}${helpLine}${fuller ? ' No need to fix anything, just wanted you to know.' : ''}`,
            `Quick check-in from me: ${join(top)}${why ? `, mostly because ${why}` : ''}.${helpLine}`],
          honest: [`I want to be honest with you — I’m feeling ${join(top)}${why ? ` because ${why}` : ''}.${mix}${helpLine}${fuller ? ' I’d rather say it than sit on it.' : ''}`,
            `Being real: today I’m ${join(top)}.${why ? ` It’s about ${why}.` : ''}${helpLine}`],
          tender: [`Can I share something? I’m feeling pretty ${join(top)} right now${why ? ` — ${why}` : ''}.${mix}${helpLine}${fuller ? ' Thank you for being someone I can tell.' : ''}`,
            `I’m a little ${join(top)} tonight${why ? `, because ${why}` : ''}. Just wanted to let you in on it.${helpLine}`]
        };
        const out = [...T[st.tone]];
        const ex = example(ws[0].id, ['text']);
        if (ex) out.push(ex);
        return out;
      }
    }
  },

  /* "I see you": words for the people in your life — what you love about them, and (honestly) the
     double-edged and shadow sides too. Their name is only asked for when you write to them. */
  people: {
    tab: 'I see you',
    prompt: 'How do you<br>see them?',
    hint: 'tap to explore<br>hold to pin',
    pins: 'fw.pins.people.v1',
    dock: () => { const n = FW.person(); return n ? `${n}’s wheel` : 'their wheel'; },
    title: () => `How I see ${FW.person() || 'them'}`,
    empty: 'Nothing pinned yet.<br>Hold a bubble — or flick it down — to pin what you see in them.',
    write: '✎ Tell them',
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
    shareTitle: () => FW.person() ? `For ${FW.person()}` : 'How I see you',
    /* warm words lift the haze, shadow-side words sink it toward red */
    aura: {
      corners: ['heart', 'mind', 'character'],
      rank: { humor: 6, heart: 5, spirit: 4, looks: 3, mind: 2, character: 1 },
      lean: { mind: 1, character: 1 },
      mood() {
        let s = 0, t = 0;
        FW.pins.forEach(p => { const f = FW.byId[p.id]; if (!f) return; s += p.amt * (SIDE_MOOD[f.side] ?? 0); t += p.amt; });
        return t ? s / t : 0;
      }
    },
    builder: {
      st: { get name() { return FW.person(); }, set name(v) { FW.setPerson(v); }, tone: 'warm', len: 'quick', esp: '' },
      controls: [
        ['input', 'name', 'Who’s it for? (stays on this phone)', 'autocapitalize="words" spellcheck="false" maxlength="40"'],
        ['seg', 'tone', [['warm', 'Warm'], ['playful', 'Playful'], ['honest', 'Honest']]],
        ['seg', 'len', [['quick', 'Quick'], ['fuller', 'Fuller']]],
        ['input', 'esp', 'especially… (optional)']
      ],
      empty: 'Pin a word or two first.',
      drafts(st) {
        const ws = pinned();
        if (!ws.length) return [];
        const lit = ws.filter(f => f.side !== 'shadow').map(f => f.word), dim = ws.filter(f => f.side === 'shadow').map(f => f.word);
        const N = FW.person(), hey = N ? `Hey ${N}` : 'Hey', full = st.len === 'fuller';
        const top = lit.slice(0, 3), more = lit.slice(3, 6), esp = clean(st.esp, /^especially\s+/i);
        const especially = esp ? ` Especially ${esp}.` : '';
        const also = full && more.length ? ` Also ${join(more)}, while I’m at it.` : '';
        const honest = dim.length ? `Sometimes you come across as ${join(dim.slice(0, 2).map(bit))}` : '';
        const out = [];
        if (top.length) {
          const you = `you’re ${join(top)}`;
          if (st.tone === 'warm') out.push(
            `${hey} — I don’t say it enough, but I think ${you}.${especially}${also}${full ? ' I notice it all the time, and I wanted you to hear it.' : ''}`,
            `Just so you know: ${you}. I mean it.${especially}`);
          if (st.tone === 'playful') out.push(
            `${hey}, friendly reminder that ${you}. That’s it, that’s the text.${esp ? ` Exhibit A: ${esp}.` : ''}${also}`,
            `Official report on ${N || 'you'}: ${top.join(', ')}.${full && more.length ? ` Also ${join(more)}.` : ''} Ten out of ten, would recommend.`);
          if (st.tone === 'honest') out.push(
            `${hey}, I want to say this plainly: I think ${you}.${especially}${also}${honest ? ` And honestly? ${honest} — I’m saying both because I care about you.` : ''}`,
            `Something I’ve been meaning to tell you: ${you}.${full ? ' Not in a throwaway way — I really see it.' : ''}${especially}`);
        }
        if (dim.length && (st.tone === 'honest' || !top.length))
          out.push(`Can I be honest about something? ${honest}.${full ? ' I’m not saying it to hurt you — I just think you’d want to know, and it doesn’t change how much I like you.' : ' I only say it because I care.'}`);
        const ex = example(ws[0].id, ws[0].side === 'shadow' ? ['gentle'] : ['text', 'say']);
        if (ex && !out.includes(ex)) out.push(ex);
        return out;
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
