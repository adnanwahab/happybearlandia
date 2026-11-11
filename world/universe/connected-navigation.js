import { contextFromURL, contextURL, shellURL, navigationMessage } from './navigation.js';
import { getExperience } from './registry.js';
import { parseIframeEvent } from '../../shared/causality/index.js';

/** Navigation chrome carries context only; it never restores or mutates simulation state. */
export function mountUniverseNavigation(container,{experienceId,onContext=()=>{}}={}) {
  if(!getExperience(experienceId)) throw new TypeError('Unknown experience');
  const doc=container.ownerDocument,win=doc.defaultView;
  let context;
  const nav=doc.createElement('nav');nav.setAttribute('aria-label','Connected universe');
  // Only a small disclosure handle is fixed over the app. Links appear on
  // request so the old bottom-left pill cannot cover game controls.
  nav.style.cssText='display:block;padding:5px 8px;font:12px system-ui;background:#101d2f;color:#edf3fa;position:fixed;bottom:max(8px,env(safe-area-inset-bottom));right:max(8px,env(safe-area-inset-right));left:auto;max-width:calc(100vw - 16px);z-index:90;border-radius:9px;box-shadow:0 2px 12px #0004';
  const toggle=doc.createElement('button'),links=doc.createElement('span');
  toggle.type='button';toggle.textContent='HBL ↗';toggle.setAttribute('aria-label','Open universe navigation');
  toggle.setAttribute('aria-expanded','false');
  toggle.style.cssText='background:none;border:0;color:#94dbe9;font:inherit;font-weight:700;cursor:pointer;padding:4px';
  links.hidden=true;links.style.cssText='display:flex;flex-wrap:wrap;gap:12px;padding:6px 3px;max-width:260px';
  const setExpanded=value=>{links.hidden=!value;toggle.setAttribute('aria-expanded',String(value));toggle.textContent=value?'Close ↑':'HBL ↗';toggle.setAttribute('aria-label',value?'Close universe navigation':'Open universe navigation');};
  toggle.addEventListener('click',()=>setExpanded(links.hidden));

  const home=doc.createElement('a'),world=doc.createElement('a'),futures=doc.createElement('a');
  home.textContent='HappyBearLandia';world.textContent='World';futures.textContent='Worldline';
  for(const a of [home,world,futures])a.style.color='#94dbe9';
  links.append(home,world,futures);nav.append(toggle,links);container.append(nav);
  const fail=()=>{nav.replaceChildren();const error=doc.createElement('span');error.setAttribute('role','alert');error.textContent='Invalid world context. Open a valid shared link to continue.';nav.append(error);};
  try{context=contextFromURL(win.location.href);}catch{fail();return Object.freeze({getContext:()=>null,dispose:()=>nav.remove()});}
  const render=()=>{home.href=shellURL(experienceId,context);world.href=shellURL('world',context);futures.href=shellURL('worldline',context);};
  const embedded=win.parent!==win;
  const publish=message=>{if(embedded)win.parent.postMessage(message,win.location.origin);};
  const receive=event=>{
    if(!embedded)return;
    try{
      const value=parseIframeEvent(event,{origin:win.location.origin,source:win.parent});
      if(value.type!=='context')return;
      if(['universeId','worldId'].some(k=>value.context[k]!==context[k]))return;
      context=value.context;win.history.replaceState(null,'',contextURL(win.location.href,context));render();onContext(structuredClone(context));
    }catch{/* Untrusted or incompatible parent messages have no effect. */}
  };
  const navigate=id=>{if(!getExperience(id))throw new TypeError('Unknown experience');if(embedded)publish(navigationMessage('navigate',context,{experienceId:id}));else win.location.assign(shellURL(id,context));};
  const click=event=>{if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const a=event.target.closest('a');if(!nav.contains(a))return;if(a===world||a===futures){event.preventDefault();navigate(a===world?'world':'worldline');}else if(a===home&&embedded){event.preventDefault();win.parent.location.assign(home.href);}};
  const restore=()=>{try{context=contextFromURL(win.location.href);nav.replaceChildren(toggle,links);setExpanded(false);render();onContext(structuredClone(context));}catch{fail();}};
  nav.addEventListener('click',click);win.addEventListener('message',receive);win.addEventListener('popstate',restore);render();publish(navigationMessage('ready',context));
  return Object.freeze({
    getContext:()=>structuredClone(context),
    select(entityId){const message=navigationMessage('select',context,{entityId});context={...context,entityId};win.history.replaceState(null,'',contextURL(win.location.href,context));render();publish(message);},
    navigate,
    dispose(){win.removeEventListener('message',receive);win.removeEventListener('popstate',restore);nav.removeEventListener('click',click);toggle.replaceWith(toggle.cloneNode(true));nav.remove();}
  });
}
