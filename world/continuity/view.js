import {contextFromURL, contextURL} from '../universe/navigation.js';
import {SURFACES, readContinuity, continuityURL} from './contract.js';
const labels = {world:'World', 'future-machine':'Future Machine', decision:'Decision Studio'};
/** A receipt is deliberately not a command to load or change a simulation. */
export function mountContinuity(container) {
  const doc=container.ownerDocument,win=doc.defaultView;
  const panel=doc.createElement('details'),summary=doc.createElement('summary'),status=doc.createElement('p'),links=doc.createElement('nav');
  summary.textContent='Place and time continuity';links.setAttribute('aria-label','Place and time destinations');
  panel.style.cssText='flex-basis:100%;max-width:100%;overflow-wrap:anywhere';
  status.setAttribute('role','status');
  panel.append(summary,status,links);container.append(panel);
  function render() {
    const receipt=readContinuity(win.location.href);
    status.textContent=receipt.status==='missing' ? 'Continuity unavailable: no checkpoint context. Destinations open their own starting view.' : receipt.status==='invalid' ? 'Continuity unavailable: invalid or unsupported context. Destinations open their own starting view.' : 'Context carried only. Camera, entity and time are not restored: these surfaces have no verified shared mapping.';
    links.replaceChildren();
    for(const surface of Object.keys(SURFACES)) {
      const a=doc.createElement('a');a.textContent=labels[surface];a.href=contextURL(continuityURL(surface,receipt.payload),contextFromURL(win.location.href));
      a.style.cssText='display:block;min-height:24px;padding:6px 0;color:#94dbe9';links.append(a);
    }
  }
  render();win.addEventListener('popstate',render);
  return {dispose(){win.removeEventListener('popstate',render);panel.remove();}};
}
