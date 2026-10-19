import './tokens.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/merriweather/standard.css';
import './styles.css';
import './gsap.js';
import './tokens.js';
import './data/index.js';
import './engine/decks.js';
import './engine/core.js';
import './engine/dock.js';
import './engine/drawer.js';
import './engine/search.js';
import './engine/aura.js';
import { createBloom } from './views/bloom.js';

const FW = window.FW;

/* labels are measured with the real fonts, so wait for them (but never hang on a slow network) */
const fontsReady = () => {
  const loads = [`800 40px ${FW.tok.css('--fw-font-display')}`, `600 14px ${FW.tok.css('--fw-font-body')}`]
    .map(f => document.fonts.load(f, 'feel'));
  return Promise.race([Promise.allSettled(loads), new Promise(r => setTimeout(r, 2500))]);
};

async function boot() {
  await fontsReady();
  FW.applyTokens();
  FW.mount({ variant: 'bloom' });
  const view = createBloom(FW.els.stage);
  FW.on('explore', id => view.go(id));
  FW.on('mode', id => view.deck(id));
  /* a search pick: go to the word, switching decks first if it lives in the other one */
  FW.on('find', ({ deck, id }) => deck && deck !== FW.deck.id ? view.deck(deck, id) : view.go(id));
  FW.on('pins', () => view.syncPins());
  let rt = 0;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { FW.measure(); view.relayout(); }, 150);
  });
  view.go(null);
  window.__fw = { view };
}

boot();

/* bubble colours are read from the tokens in JS, so a token edit reloads the page */
if (import.meta.hot) {
  import.meta.hot.on('vite:afterUpdate', p => {
    if (p.updates.some(u => u.path.includes('tokens.css'))) location.reload();
  });
}
