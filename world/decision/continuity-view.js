import { NavigationContextSchema } from '../../shared/causality/index.js';
import { navigationMessage } from '../universe/navigation.js';
import { readContinuity, recordContext, continuityLink } from './continuity.js';

const routes = [['World', '/world'], ['Worldline', '/tools/worldline'], ['Decision Studio', '/world/decision.html'], ['Experiments', '/world/experiment-lab.html'], ['Reality compiler', '/world/reality-compiler.html'], ['Constitution / Dear Congress bridge', '/world/constitution-city.html'], ['Optimization', '/world/decision.html#advanced']];
export function mountContinuity({ host = document.body, url = location.href } = {}) {
  let context;
  try { context = readContinuity(url); }
  catch (error) {
    const notice = document.createElement('p'); notice.setAttribute('role','alert'); notice.textContent = `Invalid shared decision context: ${error.message}. Correct this link before continuing across experiences.`; host.prepend(notice);
    return { update() {}, restoreContext() {}, getContext: () => null, destroy: () => notice.remove() };
  }
  const originContext = structuredClone(context);
  const section = document.createElement('details'); section.id = 'decision-continuity';
  section.style.cssText = 'margin:16px;padding:16px;border:1px solid #64748b;border-radius:12px;max-width:100%;overflow-wrap:anywhere';
  const summary = document.createElement('summary'); summary.textContent = 'Connected decision context';
  const notice = document.createElement('p'); notice.textContent = 'Hypothetical model results. World remains authoritative. Mapped geometry, synthetic outcomes and fictional narratives are separate; these links do not apply policies to World.';
  const nav = document.createElement('nav'); nav.setAttribute('aria-label','Decision continuity');
  const pre = document.createElement('pre'); pre.style.cssText = 'white-space:pre-wrap;max-height:24rem;overflow:auto';
  section.append(summary, notice, nav, pre); host.prepend(section);
  function update(snapshot = {}, identity) {
    if (identity) {
      context = recordContext(context, identity);
      if (window.parent !== window) window.parent.postMessage(navigationMessage('context',context),location.origin);
    }
    nav.replaceChildren();
    for (const [label, route] of routes) { const a = document.createElement('a'); a.textContent = label; a.href = continuityLink(route, context, location.origin); a.style.marginRight='16px'; nav.append(a); }
    pre.textContent = JSON.stringify({ context, originContext, ...snapshot }, null, 2);
  }
  update();
  return { update, restoreContext(input) {
    if (!input || new URL(url).searchParams.has('worldId')) return;
    context = NavigationContextSchema.parse(input); update();
  }, getContext: () => structuredClone(context), destroy: () => section.remove() };
}
