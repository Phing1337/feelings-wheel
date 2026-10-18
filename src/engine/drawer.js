/* Feelings wheel — drawer: "How I'm feeling" / "How I see them", pinned cards, journal copy.
   The words around the cards (title, summary, fields, sharing) come from the deck's FW.UI (decks.js). */
(function () {
const FW = window.FW;
const tag = t => (FW.deck.tags || {})[t] || t;
const openIds = new Set();
let dr, scrim, head, body, Hd = 0, isOpen = false;

FW.summary = (agg = FW.aggregate()) => FW.UI.summary(agg);
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
  return `<div class="handle"></div><div class="dtitle">${FW.esc(FW.UI.title())}</div><div class="dsum">${FW.esc(FW.summary(agg))}</div>` +
    `<div class="dbar">${agg.map(p => `<span style="width:${(p.w * 100).toFixed(1)}%;background:${p.color}"></span>`).join('')}</div>`;
}
/* the deck's extra fields: a feeling's body sense + voice, what you notice in a person */
const fields_html = (f, c) => FW.UI.fields.map(d => [].concat(c[d.key] || []).map(v => d.quote
  ? `<div class="voice" style="--c:${f.avg}">\u201c${FW.esc(v)}\u201d</div>`
  : `<div class="csense">${FW.esc((d.lead || '') + v + (d.dot && !/[.!?\u2026]$/.test(v) ? '.' : ''))}</div>`).join('')).join('');
/* a word from the thesaurus borrows its head word's fields, and says which word it belongs to;
   every card ends with all the words for its head word, tappable */
function card_html(p) {
  const f = FW.byId[p.id], h = f.head ? FW.byId[f.head] : null, c = FW.content(h ? h.id : p.id), esc = FW.esc;
  const ws = [...(h ? [h] : []), ...FW.words(p.id)];
  return `<div class="card${openIds.has(p.id) ? ' open' : ''}" data-id="${p.id}"><div class="ch"><span class="dot" style="background:${FW.fillCSS(f)}"></span>` +
    `<div class="cw">${esc(f.word)}<div class="mix">${FW.mixChips(f)}</div></div>` +
    `<div class="amt" title="How much">${[1, 2, 3].map(n => `<b data-n="${n}" class="${n <= p.amt ? 'on' : ''}"></b>`).join('')}</div></div>` +
    `<div class="cbody">${f.def ? `<div class="cdef">${esc(f.def)}</div>` : ''}` +
    (h ? `<div class="csyn">\u2248 a word for <b>${esc(h.word)}</b>${f.sounds ? ` · <i>${esc(f.sounds)}</i>` : ''}${f.from ? ` · from ${esc(f.from)}` : ''}</div>` : '') +
    fields_html(f, c) +
    (h ? [] : c.examples || []).map((e, i) => `<div class="ex" data-ex="${i}"><em>${esc(tag(e.tag))} · tap to copy</em>${esc(e.s)}</div>`).join('') +
    (ws.length ? `<div class="thes"><em>\u2248 Words for ${esc((h || f).word)}</em><div class="tw">` +
      ws.map(w => `<button class="tchip${w === h ? ' head' : ''}${w.deep ? ' deep' : ''}${w.id === p.id ? ' cur' : ''}" data-word="${w.id}">${esc(w.word)}</button>`).join('') + '</div></div>' : '') +
    `<div class="crow"><button class="btn sm" data-act="explore">Explore</button><button class="btn sm" data-act="share">Share</button><button class="btn sm" data-act="unpin">Unpin</button></div></div></div>`;
}
function render(fresh) {
  if (!dr) return;
  head.innerHTML = head_html();
  const pins = FW.pinnedSorted();
  const scroll = body.scrollTop;
  body.innerHTML = `<div class="dactions"><button class="btn primary" data-act="write">${FW.esc(FW.UI.write)}</button>` +
    `<button class="btn" data-act="journal">Copy for journal</button><button class="btn" data-act="clear">Clear</button></div>` +
    `<div class="builder${FW._builderOpen ? ' open' : ''}" id="builder"></div>` +
    (pins.length ? pins.map(card_html).join('') : `<div class="empty">${FW.UI.empty}</div>`);
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
  const lines = [`## ${FW.UI.title()} — ${d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`, '', FW.summary(), ''];
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
    if (a === 'share' && id) FW.share(FW.UI.share(FW.byId[id]), FW.UI.shareTitle());
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
FW.on('deck', () => { openIds.clear(); FW._builderOpen = false; });
/* typing their name in the builder retitles the drawer — only the head, so the input keeps focus */
FW.on('person', () => { if (isOpen) head.innerHTML = head_html(); });
})();

/* ---------- "Write a text" / "Tell them" builder: controls + drafts come from FW.UI.builder ---------- */
(function () {
const FW = window.FW;

FW.renderBuilder = el => {
  if (!el) return;
  const B = FW.UI.builder, st = B.st, esc = FW.esc;
  el.innerHTML = B.controls.map(([type, key, x, attrs = '']) => type === 'seg'
    ? `<div class="seg" data-key="${key}">${x.map(([v, l]) => `<button data-v="${v}" class="${st[key] === v ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`
    : `<input data-key="${key}" placeholder="${esc(x)}" autocomplete="off" ${attrs}>`).join('') + '<div class="bout"></div>';
  const out = el.querySelector('.bout');
  const paint = animate => {
    out.innerHTML = '';
    const list = B.drafts(st);
    if (!list.length) { out.innerHTML = `<div class="empty" style="padding:14px">${esc(B.empty)}</div>`; return; }
    list.forEach(text => {
      const d = document.createElement('div'); d.className = 'draft';
      const p = document.createElement('div'); p.textContent = text; d.appendChild(p);
      const row = document.createElement('div'); row.className = 'crow';
      [['Copy', () => FW.copy(text)], ['Share', () => FW.share(text, FW.UI.shareTitle())]].forEach(([l, fn]) => {
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
  el.querySelectorAll('input[data-key]').forEach(i => {
    i.value = st[i.dataset.key] || '';
    i.addEventListener('input', () => { st[i.dataset.key] = i.value; paint(false); });
  });
  paint(false);
};
})();
