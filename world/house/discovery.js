import {advertisedObjectActions} from './affordances.js';

/** Presentation only. A pending, failed or stale authority reply never enables a cue. */
export function createObjectDiscovery({check,onChange}) {
 let revision=0;
 return {
  clear(){revision++;onChange(null);},
  async inspect({object,home,person}){
   const current=++revision;onChange(null);
   const entries=advertisedObjectActions({object,home,person}).filter(entry=>entry.supported&&!entry.requiresConsent);
   for(const entry of entries){
    if(current!==revision)return;
    let result;try{result=await check(entry,{execution:'now',requireAuthority:true,personId:person.id,objectId:object.id,roomId:object.roomId});}catch{continue;}
    if(current!==revision)return;
    if(result?.available===true){onChange(object.id);return;}
   }
  }
 };
}

/** Native picker remains usable when the 3D renderer cannot initialize. */
export function mountObjectDiscovery(container,{check,show,open}){
 const doc=container.ownerDocument,root=doc.createElement('div');root.className='house-discovery-picker';root.dataset.discoveryPicker='';
 const label=doc.createElement('label');label.textContent='Explore objects ';const select=doc.createElement('select');select.setAttribute('aria-label','Explore objects');label.append(select);
 const button=doc.createElement('button');button.type='button';button.textContent='Inspect object';
 const status=doc.createElement('span');status.setAttribute('role','status');root.append(label,button,status);container.append(root);
 let context={},target=null,signature='',disposed=false;
 const discovery=createObjectDiscovery({check,onChange:id=>{root.dataset.availableObject=id??'';status.textContent=id?'Available to interact':'';show(id);}});
 function inspect(id){target=id;discovery.clear();const object=context.objects?.find(row=>String(row.id)===String(id));if(context.enabled&&object)void discovery.inspect({object,home:context.home,person:context.person});}
 const keydown=event=>{if(event.key==='Escape'){target=null;discovery.clear();}};select.addEventListener('keydown',keydown);
 const change=()=>{button.disabled=!context.enabled||!select.value;inspect(select.value);},focus=()=>inspect(select.value),blur=()=>{target=null;discovery.clear();},click=()=>{const object=context.objects?.find(row=>String(row.id)===select.value);if(context.enabled&&object)open(object);};
 select.addEventListener('change',change);select.addEventListener('focus',focus);select.addEventListener('blur',blur);button.addEventListener('click',click);
 return{hover:inspect,clear(){target=null;discovery.clear();},update(next){
  if(disposed)return;
  const changed=context.person?.id!==next.person?.id;context=next;
  const key=JSON.stringify(next.objects?.map(row=>[row.id,row.label,row.name,row.type]));
  if(key!==signature){signature=key;const previous=select.value;select.replaceChildren();const empty=doc.createElement('option');empty.value='';empty.textContent='Choose an object';select.append(empty);for(const object of next.objects??[]){const option=doc.createElement('option');option.value=object.id;option.textContent=object.label??object.name??object.type;select.append(option);}select.value=previous;}
  select.disabled=!next.enabled;button.disabled=!next.enabled||!select.value;
  if(changed||!next.enabled){target=null;discovery.clear();}else if(target)inspect(target);else discovery.clear();
 },destroy(){disposed=true;discovery.clear();root.remove();}};
}
