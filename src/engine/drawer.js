/* Feelings wheel — Gen 1 drawer: "How I'm feeling", pinned cards, journal copy */
(function () {
const FW = window.FW;
const TAG = { text: 'Text', say: 'Say it', opener: 'Opener', self: 'To myself' };
const openIds = new Set();
let dr, scrim, head, body, Hd = 0, isOpen = false;

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
FW.summary = (agg = FW.aggregate()) => {
  const bits = agg.filter(p => p.w >= 0.08).map(p => (p.w >= 0.45 ? 'mostly ' : p.w >= 0.2 ? 'some ' : 'a little ') + FW.fam[p.fam].name.toLowerCase());
  return bits.length ? cap(bits.join(' · ')) : 'Nothing pinned yet';
};
FW.pinnedSorted = () => [...FW.pins].sort((a, b) => b.amt - a.amt || a.t - b.t);

const scrimSync = y => gsap.set(scrim, { opacity: Math.max(0, 1 - y / (Hd + 24)) });

FW.openDrawer = () => {
  if (!isOpen) render(true);
  isOpen = true;
  gsap.set([dr, scrim], { visibility: 'visible' });
  gsap.to(dr, { y: 0, duration: FW.dur(0.6), ease: 'power3.out', overwrite: true, onUpdate: () => scrimSync(gsap.getProperty(dr, 'y')) });
};
FW.closeDrawer = () => {
  isOpen = false;
  gsap.to(dr, { y: Hd + 24, duration: FW.dur(0.45), ease: 'power2.in', overwrite: true, onUpdate: () => scrimSync(gsap.getProperty(dr, 'y')),
    onComplete: () => gsap.set([dr, scrim], { visibility: 'hidden' }) });
};

function head_html() {
  const agg = FW.aggregate();
  return `<div class="handle"></div><div class="dtitle">How I'm feeling</div><div class="dsum">${FW.summary(agg)}</div>` +
    `<div class="dbar">${agg.map(p => `<span style="width:${(p.w * 100).toFixed(1)}%;background:${p.color}"></span>`).join('')}</div>`;
}
/* a word from the thesaurus borrows its feeling's body sense and voice, and says which feeling it
   belongs to; every card ends with all the words for its feeling, tappable */
function card_html(p) {
  const f = FW.byId[p.id], h = f.head ? FW.byId[f.head] : null, c = FW.content(h ? h.id : p.id), esc = FW.esc;
  const ws = [...(h ? [h] : []), ...FW.words(p.id)];
  return `<div class="card${openIds.has(p.id) ? ' open' : ''}" data-id="${p.id}"><div class="ch"><span class="dot" style="background:${FW.fillCSS(f)}"></span>` +
    `<div class="cw">${esc(f.word)}<div class="mix">${FW.mixChips(f)}</div></div>` +
    `<div class="amt" title="How much">${[1, 2, 3].map(n => `<b data-n="${n}" class="${n <= p.amt ? 'on' : ''}"></b>`).join('')}</div></div>` +
    `<div class="cbody">${f.def ? `<div class="cdef">${esc(f.def)}</div>` : ''}` +
    (h ? `<div class="csyn">\u2248 a word for <b>${esc(h.word)}</b>${f.sounds ? ` · <i>${esc(f.sounds)}</i>` : ''}${f.from ? ` · from ${esc(f.from)}` : ''}</div>` : '') +
    (c.body ? `<div class="csense">In your body: ${esc(c.body)}</div>` : '') +
    (c.voice || []).map(v => `<div class="voice" style="--c:${f.avg}">\u201c${esc(v)}\u201d</div>`).join('') +
    (h ? [] : c.examples || []).map((e, i) => `<div class="ex" data-ex="${i}"><em>${esc(TAG[e.tag] || e.tag)} · tap to copy</em>${esc(e.s)}</div>`).join('') +
    (ws.length ? `<div class="thes"><em>\u2248 Words for ${esc((h || f).word)}</em><div class="tw">` +
      ws.map(w => `<button class="tchip${w === h ? ' head' : ''}${w.deep ? ' deep' : ''}${w.id === p.id ? ' cur' : ''}" data-word="${w.id}">${esc(w.word)}</button>`).join('') + '</div></div>' : '') +
    `<div class="crow"><button class="btn sm" data-act="explore">Explore</button><button class="btn sm" data-act="share">Share</button><button class="btn sm" data-act="unpin">Unpin</button></div></div></div>`;
}
function render(fresh) {
  if (!dr) return;
  head.innerHTML = head_html();
  const pins = FW.pinnedSorted();
  const scroll = body.scrollTop;
  body.innerHTML = `<div class="dactions"><button class="btn primary" data-act="write">✎ Write a text</button>` +
    `<button class="btn" data-act="journal">Copy for journal</button><button class="btn" data-act="clear">Clear</button></div>` +
    `<div class="builder${FW._builderOpen ? ' open' : ''}" id="builder"></div>` +
    (pins.length ? pins.map(card_html).join('') : `<div class="empty">Nothing pinned yet.<br>Hold a bubble — or flick it down — to pin how you feel.</div>`);
  FW.renderBuilder && FW.renderBuilder(body.querySelector('#builder'));
  if (fresh) gsap.from(body.querySelectorAll('.card'), { y: 18, opacity: 0, duration: FW.dur(0.45), stagger: 0.05, ease: 'power3.out', delay: 0.12 });
  else body.scrollTop = scroll;
}

function expand(card) {
  const id = card.dataset.id;
  if (card.classList.toggle('open')) {
    openIds.add(id);
    const def = card.querySelector('.cdef');
    if (window.SplitText && !FW.reduce) {
      const st = new SplitText(def, { type: 'words' });
      gsap.from(st.words, { opacity: 0, y: 10, duration: 0.45, stagger: 0.025, ease: 'power3.out', onComplete: () => st.revert() });
    }
    gsap.from(card.querySelectorAll('.csyn,.csense,.voice,.ex,.thes,.crow'), { opacity: 0, y: 10, duration: FW.dur(0.4), stagger: 0.05, delay: 0.15, ease: 'power2.out' });
  } else openIds.delete(id);
}

function journal() {
  const d = new Date(), pins = FW.pinnedSorted();
  const lines = [`## How I'm feeling — ${d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`, '', FW.summary(), ''];
  pins.forEach(p => { const f = FW.byId[p.id], h = f.head && FW.byId[f.head]; lines.push(`- ${'●'.repeat(p.amt)}${'○'.repeat(3 - p.amt)} **${f.word}**${h ? ` (\u2248 ${h.word})` : ''} — ${f.def}`); });
  lines.push('', 'Mix: ' + FW.aggregate().map(p => FW.fam[p.fam].name).join(' · '));
  return lines.join('\n');
}

let clearArmed = null;
function onBody(e) {
  const t = e.target, card = t.closest('.card'), act = t.closest('[data-act]');
  const b = t.closest('.amt b');
  if (b && card) { FW.setAmt(card.dataset.id, +b.dataset.n); return; }
  const ex = t.closest('.ex');
  if (ex && card) { const c = FW.content(card.dataset.id); FW.copy(c.examples[+ex.dataset.ex].s); gsap.fromTo(ex, { scale: 0.97 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1,.5)' }); return; }
  const tw = t.closest('.tchip');
  if (tw) { FW.closeDrawer(); setTimeout(() => FW.emit('explore', tw.dataset.word), 250); return; }
  if (act) {
    const a = act.dataset.act, id = card && card.dataset.id;
    if (a === 'write') { FW._builderOpen = !FW._builderOpen; const bl = body.querySelector('#builder'); bl.classList.toggle('open', FW._builderOpen); if (FW._builderOpen) gsap.from(bl, { opacity: 0, y: -8, duration: FW.dur(0.35) }); }
    if (a === 'journal') FW.copy(journal(), 'Copied for your journal');
    if (a === 'clear') {
      if (!FW.pins.length) return;
      if (clearArmed) { clearTimeout(clearArmed); clearArmed = null; openIds.clear(); FW.clearPins(); FW.toast('Wheel cleared'); return; }
      act.classList.add('armed'); act.textContent = 'Tap again to clear';
      clearArmed = setTimeout(() => { clearArmed = null; act.classList.remove('armed'); act.textContent = 'Clear'; }, 2500);
    }
    if (a === 'explore' && id) { FW.closeDrawer(); setTimeout(() => FW.emit('explore', id), 250); }
    if (a === 'share' && id) {
      const f = FW.byId[id], ex = !f.head && (FW.content(id).examples || []).find(x => x.tag === 'text');
      FW.share(ex ? ex.s : `Feeling ${f.word} right now${f.head ? ' \u2014 ' : '. '}${f.def}`, 'How I\u2019m feeling');
    }
    if (a === 'unpin' && id) { openIds.delete(id); FW.unpin(id); }
    return;
  }
  if (card && t.closest('.ch')) expand(card);
}

FW.initDrawer = () => {
  dr = FW.els.drawer; scrim = FW.els.scrim;
  dr.innerHTML = '<div class="dhead" id="dhead"></div><div class="dbody" id="dbody"></div>';
  head = dr.querySelector('#dhead'); body = dr.querySelector('#dbody');
  Hd = dr.offsetHeight || FW.H * 0.92;
  gsap.set(dr, { y: Hd + 24 });
  scrim.addEventListener('click', FW.closeDrawer);
  body.addEventListener('click', onBody);
  let lastY = 0, lastT = 0, vy = 0;
  if (window.Draggable) Draggable.create(dr, { type: 'y', trigger: head, bounds: { minY: 0, maxY: Hd + 24 }, edgeResistance: 0.85,
    onPress() { gsap.killTweensOf(dr); lastY = this.y; lastT = performance.now(); vy = 0; },
    onDrag() { const now = performance.now(); vy = (this.y - lastY) / Math.max(1, now - lastT); lastY = this.y; lastT = now; scrimSync(this.y); },
    onRelease() { (this.y > Hd * 0.28 || vy > 0.5) ? FW.closeDrawer() : FW.openDrawer(); } });
};
FW.on('pins', () => isOpen && render(false));
})();

/* ---------- "Write a text" builder ---------- */
(function () {
const FW = window.FW;
const st = { tone: 'honest', len: 'quick', because: '', help: '' };
const join = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const clean = s => s.trim().replace(/^because\s+/i, '').replace(/[.!\s]+$/, '');

function drafts() {
  const pins = FW.pinnedSorted();
  if (!pins.length) return [];
  const words = pins.map(p => FW.byId[p.id].word), top = words.slice(0, 2);
  const why = clean(st.because), help = clean(st.help);
  const helpLine = help ? ` What would help: ${help}.` : '';
  const fuller = st.len === 'fuller';
  const rest = words.slice(2, 5);
  const mix = fuller && rest.length ? ` There\u2019s a bit of ${join(rest)} in there too.` : '';
  const T = {
    light: [`Hey — small heads up, I'm feeling a bit ${join(top)} today${why ? ` (${why})` : ''}.${mix}${helpLine}${fuller ? ' No need to fix anything, just wanted you to know.' : ''}`,
      `Quick check-in from me: ${join(top)}${why ? `, mostly because ${why}` : ''}.${helpLine}`],
    honest: [`I want to be honest with you — I'm feeling ${join(top)}${why ? ` because ${why}` : ''}.${mix}${helpLine}${fuller ? ' I\u2019d rather say it than sit on it.' : ''}`,
      `Being real: today I'm ${join(top)}.${why ? ` It's about ${why}.` : ''}${helpLine}`],
    tender: [`Can I share something? I'm feeling pretty ${join(top)} right now${why ? ` — ${why}` : ''}.${mix}${helpLine}${fuller ? ' Thank you for being someone I can tell.' : ''}`,
      `I'm a little ${join(top)} tonight${why ? `, because ${why}` : ''}. Just wanted to let you in on it.${helpLine}`]
  };
  const out = [...T[st.tone]];
  const ex = (FW.content(pins[0].id).examples || []).find(e => e.tag === 'text');
  if (ex) out.push(ex.s);
  return out;
}

FW.renderBuilder = el => {
  if (!el) return;
  const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${st[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  el.innerHTML = seg('tone', [['light', 'Light'], ['honest', 'Honest'], ['tender', 'Tender']]) + seg('len', [['quick', 'Quick'], ['fuller', 'Fuller']]) +
    `<input id="bWhy" placeholder="because… (optional)"><input id="bHelp" placeholder="what would help… (optional)"><div id="bOut"></div>`;
  const why = el.querySelector('#bWhy'), help = el.querySelector('#bHelp'), out = el.querySelector('#bOut');
  why.value = st.because; help.value = st.help;
  const paint = animate => {
    out.innerHTML = '';
    const list = drafts();
    if (!list.length) { out.innerHTML = '<div class="empty" style="padding:14px">Pin a feeling or two first.</div>'; return; }
    list.forEach(text => {
      const d = document.createElement('div'); d.className = 'draft';
      const p = document.createElement('div'); p.textContent = text; d.appendChild(p);
      const row = document.createElement('div'); row.className = 'crow';
      [['Copy', () => FW.copy(text)], ['Share', () => FW.share(text, 'How I\u2019m feeling')]].forEach(([l, fn]) => {
        const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = l; b.onclick = fn; row.appendChild(b);
      });
      d.appendChild(row); out.appendChild(d);
    });
    if (animate) gsap.from(out.children, { opacity: 0, y: 8, duration: FW.dur(0.35), stagger: 0.06, ease: 'power2.out' });
  };
  el.querySelectorAll('.seg').forEach(s => s.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    st[s.dataset.key] = b.dataset.v;
    s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    paint(true);
  }));
  why.addEventListener('input', () => { st.because = why.value; paint(false); });
  help.addEventListener('input', () => { st.help = help.value; paint(false); });
  paint(false);
};
})();
