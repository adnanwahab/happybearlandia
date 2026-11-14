/** Read-only projection of retained checkpoint evidence. Never infer missing events or clocks. */
export function householdScrapbook(model,householdId){
 const prefix=model.prefix+'-h',index=Number(householdId?.slice(prefix.length));
 if(householdId!==prefix+index||!Number.isInteger(index)||index<0||index>=model.households.size.length)throw Error('Choose a household in this checkpoint.');
 const residents=new Set(Array.from(model.people.household,(h,i)=>h===index?model.prefix+'-p'+i:null).filter(Boolean));
 const seen=new Set(),entries=[];
 const retainedPhotos=Object.values(model.houses?.homes??{}).flatMap(h=>h.systems?.dates?.memories?.photos??[]);
 for(const event of model.events??[]){
  if(event.householdId!==householdId&&!residents.has(event.personId)&&!(event.personIds??[]).some(id=>residents.has(id)))continue;
  if(typeof event.id!=='string'||seen.has(event.id)||event.schemaVersion!=='event.v2'||event.modelVersion!==model.modelVersion||!Number.isSafeInteger(event.tick)||event.tick<0||event.tick>model.tick||!Number.isFinite(event.minute)||event.minute<0||event.minute>model.minute||typeof event.type!=='string')continue;
  seen.add(event.id);
  // Only explicit event media references can establish a photo's source tick.
  const photos=retainedPhotos.filter(p=>p.id===event.photoId&&p.personIds?.some(id=>residents.has(id)));
  entries.push({id:event.id,tick:event.tick,minute:event.minute,title:event.type.replaceAll('_',' '),synthetic:event.synthetic===true,placeId:event.placeId??event.locationId??null,photos:structuredClone(photos),source:structuredClone(event)});
 }
 entries.sort((a,b)=>a.minute-b.minute||a.tick-b.tick||(a.id<b.id?-1:a.id>b.id?1:0));
 return{schemaVersion:'household-scrapbook.v1',householdId,modelVersion:model.modelVersion,seed:model.config.seed,checkpointTick:model.tick,entries};
}

export function mountHouseholdScrapbook(container,{load,storage,storageKey='hbl-scrapbook-hidden'}={}){
 const doc=container.ownerDocument,button=doc.createElement('button'),dialog=doc.createElement('dialog');
 button.type='button';button.textContent='Life scrapbook';button.dataset.houseScrapbook='';container.querySelector('.house-top-actions')?.append(button);
 dialog.setAttribute('aria-label','Life scrapbook');dialog.style.cssText='width:min(640px,90vw);max-height:85dvh;overflow:auto';container.append(dialog);
 const el=(tag,text,parent=dialog)=>{const n=doc.createElement(tag);n.textContent=text;parent.append(n);return n;};
 el('h2','Life scrapbook');const close=el('button','Close scrapbook');close.type='button';close.onclick=()=>{dialog.close();button.focus();};
 el('p','Retained checkpoint events only. Synthetic events describe modeled lives. Missing history is never reconstructed. Source ticks open event records, not historical world scenes.');
 const label=el('label',''),hide=doc.createElement('input');hide.type='checkbox';label.append(hide,doc.createTextNode(' Hide remembered content (including sensitive or speculative material)'));
 const status=el('p','');status.setAttribute('role','status');const body=el('div','');let data=null,destroyed=false;
 try{storage??=doc.defaultView.localStorage;hide.checked=storage?.getItem(storageKey)!=='show';}catch{hide.checked=true;}
 function render(){body.replaceChildren();if(hide.checked){el('p','Remembered content is hidden on this device.',body);return;}if(!data?.entries.length){el('p','No retained household events with verifiable source ticks. Photos without an explicit source event are omitted.',body);return;}
  for(const entry of data.entries){const card=el('article','',body);el('h3',entry.title,card);el('p',(entry.synthetic?'Synthetic modeled event':'Recorded event; source classification unspecified')+' · minute '+entry.minute,card);if(entry.placeId!==null)el('p','Place ID: '+entry.placeId,card);
   const details=el('details','',card);el('summary','Open source tick '+entry.tick,details);const source=el('pre',JSON.stringify({modelVersion:data.modelVersion,seed:data.seed,checkpointTick:data.checkpointTick,event:entry.source},null,2),details);source.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
   for(const photo of entry.photos){if(!/^\/api\/world-experiments\/[A-Za-z0-9_-]{8,16}\/date-media\/[A-Za-z0-9_-]{8,100}(?:\/image)?$/.test(photo.url))continue;const img=doc.createElement('img');img.src=photo.url;img.alt='Recorded photo '+photo.id;img.loading='lazy';img.style.maxWidth='100%';card.append(img);}
  }
 }
 hide.onchange=()=>{try{storage?.setItem(storageKey,hide.checked?'hide':'show');status.textContent='Display preference saved on this device.';}catch{status.textContent='Preference applies to this view only; device storage is unavailable.';}render();};
 button.onclick=async()=>{dialog.showModal();status.textContent='Reading checkpoint…';body.replaceChildren();try{data=await load();if(!destroyed){status.textContent='Checkpoint tick '+data.checkpointTick+' · model '+data.modelVersion;render();}}catch(error){if(!destroyed)status.textContent='Scrapbook unavailable: '+error.message;}};
 return{destroy(){destroyed=true;button.remove();dialog.remove();}};
}
