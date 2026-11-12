import { canonicalId, NavigationContextSchema, encodeNavigationContext, decodeNavigationContext, IframeMessageSchema, parseIframeEvent, IFRAME_CHANNEL } from '../../shared/causality/index.js';
import { getExperience } from './registry.js';

// Navigation defaults name a browsing stage, never fabricate a recorded RunContext.
export const DEFAULT_CONTEXT = Object.freeze({
  universeId: canonicalId('universe','hbl','main'),
  worldId: canonicalId('world','hbl','main'),
  scenarioId: canonicalId('scenario','hbl','baseline'),
});
const contextKeys = ['universeId','worldId','scenarioId','experimentId','runId','branchId','tick','entityId'];
const base = () => globalThis.location?.origin || 'http://localhost';
export function contextFromURL(input) {
  const url = new URL(input,base());
  for (const [key,value] of Object.entries(DEFAULT_CONTEXT)) if (!url.searchParams.has(key)) url.searchParams.set(key,value);
  return decodeNavigationContext(url.searchParams);
}
export function contextURL(route,context) {
  const url = new URL(route,base());
  if (url.origin !== base() || !['http:','https:'].includes(url.protocol)) throw new TypeError('Expected same-origin route');
  const query = new URLSearchParams(encodeNavigationContext(context));
  for (const key of contextKeys) url.searchParams.delete(key);
  for (const [key,value] of query) url.searchParams.set(key,value);
  return url.pathname + url.search + url.hash;
}
export function shellURL(experienceId,context) {
  if (experienceId && !getExperience(experienceId)) throw new TypeError('Unknown experience');
  return contextURL(experienceId ? `/?app=${encodeURIComponent(experienceId)}` : '/',context);
}
export function navigationMessage(type,context,extra={}) {
  return IframeMessageSchema.parse({version:1,channel:IFRAME_CHANNEL,requestId:globalThis.crypto.randomUUID(),type,context,...extra});
}
/** One active same-origin iframe; rejected messages cannot mutate URL/context. */
export function createFrameBridge({frame,context,onContext,onNavigate,host=globalThis.window}) {
  const origin = host.location.origin;
  let live = true;
  const send = () => { if (live) frame.contentWindow?.postMessage(navigationMessage('context',context()),origin); };
  const receive = event => {
    let message;
    try {
      message = parseIframeEvent(event,{origin,source:frame.contentWindow});
      const current = context();
      if (['universeId','worldId'].some(key=>message.context[key]!==current[key])) return;
      if (message.type !== 'context' && message.context.scenarioId!==current.scenarioId) return;
      // A selection/navigation from an obsolete run must not overwrite the active run.
      if (message.type !== 'context' && ['experimentId','runId','branchId','tick'].some(key=>current[key]!==undefined && message.context[key]!==current[key])) return;
      if (message.type === 'navigate' && !getExperience(message.experienceId)) return;
      if (['context','select','navigate'].includes(message.type)) {
        const next = NavigationContextSchema.parse({...current,...message.context,...(message.entityId ? {entityId:message.entityId}: {})});
        onContext(next);
      }
      if (message.type === 'ready') send();
      if (message.type === 'navigate') onNavigate(message.experienceId);
    } catch { /* Untrusted or incompatible messages have no effect. */ }
  };
  frame.addEventListener('load',send);
  host.addEventListener('message',receive);
  return () => {live=false; frame.removeEventListener('load',send);host.removeEventListener('message',receive);};
}
