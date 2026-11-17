import {searchExperiences} from './registry.js';
import {contextFromURL, contextURL} from './navigation.js';

const labels={follow:'Follow selection',compare:'Compare · side by side',why:'WHY · inspect recorded outcome',photo:'Photo · take photo together'};
// Owners opt in actual controls. Their disabled state and command handlers remain authoritative.
export function availableActions(doc) {
  return [...doc.querySelectorAll('button[data-palette-action]')].filter(button=>
    labels[button.dataset.paletteAction] && !button.disabled && !button.matches?.(':disabled, [aria-disabled="true"]') && button.getClientRects().length &&
    (!doc.defaultView || doc.defaultView.getComputedStyle(button).visibility!=='hidden') &&
    !button.closest('[hidden], [inert], [aria-hidden="true"]'));
}
export function mountCommandPalette(container) {
  const doc=container.ownerDocument, win=doc.defaultView;
  const style=doc.createElement('link');style.rel='stylesheet';style.href='/world/universe/command-palette.css';doc.head.append(style);
  const trigger=doc.createElement('button');trigger.type='button';trigger.className='hbl-command-trigger';trigger.textContent='Search / ⌘ K';trigger.setAttribute('aria-label','Search routes and actions');trigger.setAttribute('aria-keyshortcuts','Meta+K Control+K');
  const dialog=doc.createElement('dialog');dialog.className='hbl-command';dialog.setAttribute('aria-label','Travel and actions');
  dialog.innerHTML='<header><label for="hbl-command-query">Travel and actions</label><button type="button" aria-label="Close command palette">Escape ×</button></header><input id="hbl-command-query" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="hbl-command-results" aria-describedby="hbl-command-status" autocomplete="off" placeholder="Search names, routes, follow, compare, WHY, photo"><p id="hbl-command-status" role="status" aria-live="polite"></p><div id="hbl-command-results" role="listbox" aria-label="Routes and available actions"></div>';
  container.append(trigger,dialog);
  const input=dialog.querySelector('input'),list=dialog.querySelector('[role=listbox]'),status=dialog.querySelector('[role=status]');
  let rows=[],index=0,opener=null,context=null;
  function highlight(){
    [...list.children].forEach((node,i)=>node.setAttribute('aria-selected',String(i===index)));
    if(rows.length){input.setAttribute('aria-activedescendant',list.children[index].id);list.children[index].scrollIntoView({block:'nearest',behavior:'instant'});}
    else input.removeAttribute('aria-activedescendant');
  }
  function render(){
    const query=input.value.trim().toLowerCase(),terms=query.split(/\s+/).filter(Boolean);
    rows=(context?availableActions(doc):[]).map(button=>({label:labels[button.dataset.paletteAction]+' · '+button.textContent,button,scope:button.dataset.paletteContext??button.textContent})).filter(row=>terms.every(t=>row.label.toLowerCase().includes(t)));
    if(context)rows.push(...searchExperiences(query).map(app=>({label:app.title+' · '+app.route,href:contextURL(app.route,context)})));
    list.replaceChildren();index=0;
    rows.forEach((row,i)=>{const node=doc.createElement('div');node.id='hbl-command-option-'+i;node.setAttribute('role','option');node.textContent=row.label;node.addEventListener('click',()=>execute(i));list.append(node);});
    status.textContent=context?`${rows.length} results. Arrow keys to choose, Enter to open.`:'Invalid navigation context. Open a valid shared link.';highlight();
  }
  function close(){dialog.close();input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');if(opener?.isConnected)opener.focus({preventScroll:true});}
  function execute(i){
    const row=rows[i];if(!row)return;
    // A changed run/time/context must not navigate with an earlier palette snapshot.
    try{if(JSON.stringify(contextFromURL(win.location.href))!==JSON.stringify(context)){context=contextFromURL(win.location.href);render();return;}}catch{context=null;render();return;}

    if(row.button){
      // Recheck immediately: a removed/replaced selection, busy operation or revoked permission fails closed.
      if(!availableActions(doc).includes(row.button)||(row.button.dataset.paletteContext??row.button.textContent)!==row.scope){render();status.textContent='Action unavailable. Selection or permissions changed.';return;}
      close();row.button.click();if(row.button.isConnected)row.button.focus({preventScroll:true});return;
    }
    close();win.location.assign(row.href);
  }
  function open(){if(dialog.open)return;opener=doc.activeElement;try{context=contextFromURL(win.location.href);}catch{context=null;}input.value='';dialog.showModal();input.setAttribute('aria-expanded','true');render();input.focus();}
  function shortcut(event){if(event.isComposing||doc.body.classList.contains('launch-world'))return;if((event.metaKey||event.ctrlKey)&&!event.altKey&&!event.shiftKey&&event.key.toLowerCase()==='k'){event.preventDefault();event.stopPropagation();dialog.open?close():open();}}
  function keys(event){event.stopPropagation();if(event.isComposing)return;if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(rows.length)index=(index+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length;highlight();}else if(event.key==='Enter'){event.preventDefault();execute(index);}else if(event.key==='Escape'){event.preventDefault();close();}}
  input.addEventListener('input',render);dialog.addEventListener('keydown',keys);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.querySelector('button').onclick=close;trigger.onclick=open;win.addEventListener('keydown',shortcut,true);
  return {open,dispose(){win.removeEventListener('keydown',shortcut,true);if(dialog.open)close();trigger.remove();dialog.remove();style.remove();}};
}
