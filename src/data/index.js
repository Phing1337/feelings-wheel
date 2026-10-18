/* The decks come from YAML — feelings in content/, people in content/people/ — compiled by
   scripts/vite-plugin-feelings.js. They're published as a global because the engine reads them when it loads. */
import decks, { warnings } from 'virtual:decks';

window.FW_DECKS = decks;

Object.entries(warnings).forEach(([id, list]) => {
  if (!list.length) return;
  console.groupCollapsed(`${id}: ${list.length} content warning${list.length > 1 ? 's' : ''} (npm run words:check ${id})`);
  list.forEach(w => console.warn(`${w.where}  ${w.msg}`));
  console.groupEnd();
});
