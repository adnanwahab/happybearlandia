/** Inline exact-text law library. The host owns editor replacement/comparison.
 * mountLawLibrary(container,{laws=LAW_CATALOG,onSelect}) -> {destroy,setLaws}.
 */
import {LAW_CATALOG} from './catalog.js';
import {groupLawCatalog} from './law-panel.js';

export function mountLawLibrary(container,{laws=LAW_CATALOG,onSelect}={}){
 if(!container?.ownerDocument)throw new TypeError('Law library requires a container');
 const doc=container.ownerDocument,root=doc.createElement('section');
 const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./law-panel.css',import.meta.url).href;(doc.head||container).append(sheet);
 root.className='law-library';root.dataset.testid='law-library';root.setAttribute('aria-label','Supplied law library');
 const el=(tag,text,parent=root)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
 el('h2','Choose a law');
 el('p','The supplied list contains laws 11–100. Laws 1–10 were not supplied. Selecting a law fills the plan editor with its exact text.');
 const label=el('label','Search laws'),search=el('input',undefined,label);
 search.type='search';search.setAttribute('aria-label','Search laws');search.placeholder='Number, category or words';
 const count=el('p');count.setAttribute('role','status');count.setAttribute('aria-live','polite');
 const list=el('div');list.className='law-library-groups';
 let selected=null,destroyed=false;
 function render(){
  if(destroyed)return;
  list.replaceChildren();let matches=0;
  const query=search.value.trim().toLocaleLowerCase();
  for(const group of groupLawCatalog(laws)){
   const rows=group.laws.filter(law=>(law.number+' '+group.title+' '+(law.text??law.title??'')).toLocaleLowerCase().includes(query));
   if(!rows.length)continue;
   const section=el('details',undefined,list);section.open=Boolean(query);
   el('summary',group.title+' ('+rows.length+')',section);
   for(const law of rows){
    const button=el('button',law.number+'. '+(law.text??law.title??''),section);
    button.type='button';button.dataset.lawId=String(law.id??law.number);
    button.setAttribute('aria-pressed',String(selected===String(law.id??law.number)));
    button.addEventListener('click',()=>{
     if(destroyed)return;
     selected=String(law.id??law.number);
     for(const peer of list.querySelectorAll('button[data-law-id]'))peer.setAttribute('aria-pressed',String(peer.dataset.lawId===selected));
     onSelect?.(law);
    });
    matches++;
   }
  }
  count.textContent=matches+' matching laws';
 }
 const keys=event=>event.stopPropagation();
 root.addEventListener('keydown',keys);search.addEventListener('input',render);
 container.append(root);render();
 return{setLaws(next){laws=next;render();},destroy(){if(destroyed)return;destroyed=true;root.removeEventListener('keydown',keys);search.removeEventListener('input',render);root.remove();sheet.remove();}};
}
