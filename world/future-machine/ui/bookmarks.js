import {BOOKMARK_KEY,readBookmarks,saveBookmarks} from '../bookmarks.js';

export function mountBookmarks(container,{storage,getContext,onOpen,onExport}){
  const doc=container.ownerDocument,root=doc.createElement('section');root.className='fm-demo';root.setAttribute('aria-label','Personal event bookmarks');
  const title=doc.createElement('h2');title.textContent='Personal event bookmarks';
  const help=doc.createElement('p');help.textContent='Named scenes stay on this browser. Reopen requires the saved run. Monthly states are recomputed from its manifest, not verified stored checkpoints. Exports include your labels and synthetic recipes.';
  const input=doc.createElement('input');input.maxLength=80;input.setAttribute('aria-label','Bookmark label');
  const status=doc.createElement('p');status.setAttribute('role','status');
  const list=doc.createElement('ol');let rows=[],busy=false,broken=false;
  function button(text,fn){const b=doc.createElement('button');b.type='button';b.textContent=text;b.onclick=async()=>{try{await fn();}catch(e){status.textContent=`Bookmark unavailable: ${e.message}`;}};return b;}
  function render(){list.replaceChildren();if(!rows.length){const empty=doc.createElement('li');empty.textContent='No bookmarks saved.';list.append(empty);}rows.forEach((row,i)=>{const li=doc.createElement('li');li.append(button(`Reopen ${row.label} · Month ${row.month}`,async()=>{if(busy)return;busy=true;update();try{await onOpen(row);status.textContent=`Opened ${row.label} at Month ${row.month}.`;}finally{busy=false;update();}}),button(`Remove ${row.label}`,()=>{rows=saveBookmarks(storage,rows.filter((_,n)=>n!==i));render();status.textContent='Bookmark removed.';}));list.append(li);});update();}
  const save=button('Save event bookmark',()=>{if(busy||broken)return;const label=input.value.trim();if(!label)throw new Error('Enter a bookmark label.');const context=getContext();if(!context)throw new Error('Complete a comparison first.');rows=saveBookmarks(storage,[...rows,{...context,label}]);input.value='';render();status.textContent='Bookmark saved locally.';});
  const clear=button('Remove all bookmarks',()=>{storage.removeItem(BOOKMARK_KEY);rows=[];broken=false;render();status.textContent='All local bookmarks removed.';});
  const exp=button('Export recipes and bookmarks',()=>onExport({schemaVersion:'future-machine-bookmarks.v1',replay:'Saved manifests recomputed; not verified checkpoint recovery.',bookmarks:readBookmarks(storage)}));
  function update(){save.disabled=busy||broken||!getContext();exp.disabled=busy||broken||!rows.length;input.disabled=busy;for(const b of list.querySelectorAll('button'))b.disabled=busy;clear.disabled=busy;}
  root.append(title,help,input,save,clear,exp,status,list);container.append(root);
  try{rows=readBookmarks(storage);}catch(e){broken=true;status.textContent=e.message;}render();
  return {update,dispose(){root.remove();}};
}
