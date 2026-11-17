/** Renderer-independent read/step UI for a single Population authority. */
export function nearbyResidents(snapshot, {x=0,z=0,radius=500}={}) {
 return (snapshot?.visibleAgents??[]).filter(p=>typeof p.id==='string'&&Number.isFinite(p.x)&&Number.isFinite(p.z))
  .map(p=>({...p,distance:Math.hypot(p.x-x,p.z-z)})).filter(p=>p.distance<=radius)
  .sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
}
export function residentEvents(person) {
 // Decision traces are retained executed decisions, unlike currentAlternatives.
 return (person?.decisionTrace??[]).filter(e=>e.actorId===person.id&&typeof e.id==='string'&&Number.isFinite(e.minute));
}
export function mountTextAdventure({root,runtime}) {
 const doc=root.ownerDocument;let selected=null,busy=false,destroyed=false;
 const el=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const heading=el('h1','World · Text adventure');heading.tabIndex=-1;
 const status=el('p');status.setAttribute('role','status');
 const content=el('section');content.setAttribute('aria-label','Scene inspection');
 const controls=el('nav');controls.setAttribute('aria-label','Allowed commands');
 const button=(label,action)=>{const b=el('button',label);b.type='button';b.onclick=()=>void act(action);return b;};
 const look=button('Look nearby',()=>showWorld());
 const step=button('Advance 30 modeled minutes',async()=>{await runtime.step();if(selected)await showResident(selected);else showWorld();});
 const clear=button('Clear this local run',()=>{destroyed=true;runtime.destroy();controls.remove();content.replaceChildren(el('p','Local run cleared. Nothing was shared or saved.'));status.textContent='Run cleared.';heading.focus();});
 controls.append(look,step,clear);
 root.replaceChildren(heading,el('p','Synthetic Population scene. Inspect, look nearby, advance time, or clear this run. No movement or conversation commands are supported here. Private to this tab; reload discards this run.'),controls,status,content);
 function focusTitle(){content.querySelector('h2')?.focus();}
 function title(text){const n=el('h2',text);n.tabIndex=-1;content.replaceChildren(n);}
 function detail(label,value){const d=el('details');d.append(el('summary',label),el('pre',JSON.stringify(value??null,null,2)));content.append(d);}
 function provenance(s){detail('Run inputs and source provenance',{modelVersion:s.modelVersion,run:s.runtime,config:s.config,residentRules:s.residentRules,reset:s.resetProvenance,source:s.provenance,limitations:s.limitations});}
 async function act(action){if(busy||destroyed)return;let failed=false;busy=true;root.setAttribute('aria-busy','true');for(const b of controls.querySelectorAll('button'))b.disabled=true;
  try{await action();if(!destroyed)status.textContent='Inspection updated.';}catch{content.replaceChildren(el('p','Data unavailable or access denied. No result has been inferred. Use Look nearby to retry.'));status.textContent='Inspection failed.';failed=true;}
  finally{busy=false;root.removeAttribute('aria-busy');for(const b of controls.querySelectorAll('button'))b.disabled=false;if(failed)look.focus();}}
 function showWorld(){selected=null;const s=runtime.getSnapshot();title('Nearby residents');
  content.append(el('p',`At modeled minute ${s?.minute??'unavailable'}. Within 500 world meters of scene origin (0, 0); retained visible sample only, not a complete census.`));
  const rows=nearbyResidents(s);if(!rows.length)content.append(el('p','No verified nearby residents in the current sample.'));
  const list=el('ul');for(const p of rows){const li=el('li');li.append(button(`Inspect ${p.name??p.id} · ${Math.round(p.distance)} m`,()=>showResident(p.id)));list.append(li);}content.append(list);
  const metrics=el('dl');for(const [key,label] of [['syntheticPopulation','Synthetic residents (people)'],['households','Synthetic households (households)']]){const value=s?.metrics?.[key];metrics.append(el('dt',label),el('dd',Number.isFinite(value)?String(value):'Unavailable'));}content.append(metrics);
  // Remaining raw fields retain their authoritative names.
  detail('Actual model metrics (raw fields; consult model definitions)',s?.metrics);provenance(s??{});focusTitle();}
 async function showResident(id){const person=await runtime.inspectPerson(id);if(!person||person.id!==id)throw Error('Resident unavailable');selected=id;title(`Resident · ${person.name??id}`);
  content.append(el('p',`${person.id} · ${person.currentActivity??'Activity unavailable'} · household ${person.householdId??'unavailable'}`));
  const events=residentEvents(person);if(!events.length)content.append(el('p','No retained decision events for this resident. Advance time to observe decisions; missing history is not reconstructed.'));
  const list=el('ul');for(const event of events){const li=el('li');li.append(button(`Event ${event.type} · minute ${event.minute}`,()=>showEvent(person,event)));list.append(li);}content.append(list);focusTitle();}
 function showEvent(person,event){title(`Event · ${event.type}`);content.append(el('p',`${event.id} · actor ${event.actorId} · modeled minute ${event.minute}. Recorded decision; not an observed human action.`),button('WHY this event?',()=>showWhy(person,event)),button('Back to resident',()=>showResident(person.id)));focusTitle();}
 function showWhy(person,event){title('WHY · Recorded decision evidence');content.append(el('p',event.reason??'No narrative reason retained.'));
  if(!event.inputs)content.append(el('p','Recorded inputs unavailable. No explanation inferred.'));
  detail('Recorded event and inputs',event);provenance(runtime.getSnapshot()??{});content.append(button('Back to event',()=>showEvent(person,event)));focusTitle();}
 showWorld();
 return {destroy(){destroyed=true;runtime.destroy();root.replaceChildren();}};
}
