/* The feelings come from content/*.yaml, compiled by scripts/vite-plugin-feelings.js.
   They're published as globals because the engine files read them when they load. */
import data, { warnings } from 'virtual:feelings';
import content from 'virtual:feelings/content';

window.FEELINGS_DATA = data;
window.FEELINGS_CONTENT = content;

if (warnings.length) {
  console.groupCollapsed(`feelings: ${warnings.length} content warning${warnings.length > 1 ? 's' : ''} (npm run words:check)`);
  warnings.forEach(w => console.warn(`${w.where}  ${w.msg}`));
  console.groupEnd();
}
