import {TOUR_VERSION,anchorRecord,validateRecipe,resolveStep,moveStep,tourURL,readTour} from './core.js';
export function mountCityTour({container,loadedRecord=null,restored=false,pause=()=>{},fetchImpl=fetch,navigate=url=>location.assign(url)}){
 const doc=container.ownerDocument,root=doc.createElement('details');root.dataset.testid='city-tour';root.setAttribute('data-map-pan-ignore','');
 const make=(tag,label,parent=root)=>{const n=doc.createElement(tag);n.textContent=label;parent.append(n);return n;};
 make('summary','Make your own city tour');
 make('style','[data-testid=city-tour]{max-width:320px;padding:8px;overflow-wrap:anywhere}[data-testid=city-tour] button{min-height:44px;margin:2px}[data-testid=city-tour] textarea,[data-testid=city-tour] input:not([type=checkbox]){box-sizing:border-box;width:100%}[data-testid=city-tour] :focus-visible{outline:3px solid #ffd77a}[data-testid=city-tour] li{margin-block:12px}');
 make('p','Saved checkpoints and camera cuts. Manual playback: no timed motion. Draft stays in this page until explicitly exported.');
 const status=make('p','Add 3–8 existing saved experiment IDs. Save new views with World’s Save control first.');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const titleLabel=make('label','Tour title'),title=make('input','',titleLabel);title.value='My city tour';title.maxLength=100;
 const idLabel=make('label','Saved experiment ID'),id=make('input','',idLabel);id.maxLength=16;
 const descLabel=make('label','Description (your interpretation)'),description=make('textarea','',descLabel);description.maxLength=500;
 const add=make('button','Add saved checkpoint'),list=make('ol','');
 const play=make('button','Play'),previous=make('button','Previous'),next=make('button','Skip / next'),reverse=make('button','Reverse route');
 const rightsLabel=make('label',''),rights=make('input','',rightsLabel);rights.type='checkbox';make('span',' I have the right to share these references and descriptions. Recipients may retain copies.',rightsLabel);
 const exportButton=make('button','Export read-only recipe'),jsonLabel=make('label','Recipe JSON'),json=make('textarea','',jsonLabel);json.maxLength=20000;
 const load=make('button','Open as read-only guest'),clear=make('button','Delete local tour');
 let steps=[],index=0,guest=false,busy=false,disposed=false;const invalid=new Map();
 function render(){
  list.replaceChildren();
  steps.forEach((s,i)=>{const li=make('li',`${i+1}. ${s.description||'Saved view'} · ${s.id} · ${s.source} · ${s.modelVersion} / ${s.checkpointVersion} · ${s.checksum}`,list);if(invalid.has(s)){li.dataset.invalid='true';make('strong',' · Invalid checkpoint: '+invalid.get(s),li);}li.draggable=!guest;li.dataset.index=String(i);
   li.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',String(i)));li.addEventListener('dragover',e=>e.preventDefault());li.addEventListener('drop',e=>{e.preventDefault();if(guest||busy)return;steps=moveStep(steps,Number(e.dataTransfer.getData('text/plain')),i);render();});
   if(!guest)for(const [label,to]of [['Move up',i-1],['Move down',i+1],['Remove',null]]){const b=make('button',label,li);b.setAttribute('aria-label',`${label} step ${i+1}`);b.disabled=busy||to!==null&&(to<0||to>=steps.length);b.onclick=()=>{if(to===null)steps.splice(i,1);else steps=moveStep(steps,i,to);render();};}
  });
  for(const n of [titleLabel,idLabel,descLabel,add,rightsLabel,exportButton])n.hidden=guest;
  add.disabled=busy||steps.length>=8;play.disabled=busy||steps.length<3;previous.disabled=busy||index<=0;next.disabled=busy||index>=steps.length-1;reverse.disabled=busy||steps.length<3;clear.disabled=busy;load.disabled=busy;exportButton.disabled=busy||!rights.checked||steps.length<3;
 }
 const recipe=()=>validateRecipe({version:TOUR_VERSION,title:title.value,steps});
 async function task(work){if(busy||disposed)return;busy=true;render();try{await work();}catch(e){if(!disposed)status.textContent=e.message;}finally{busy=false;if(!disposed)render();}}
 async function go(i){const r=recipe(),step=r.steps[i];index=i;pause();try{await resolveStep(step,fetchImpl);invalid.delete(step);}catch(e){invalid.set(step,e.message);status.textContent=`Invalid step ${i+1}: ${e.message}. You can skip it.`;return;}if(!disposed)navigate(tourURL(r,i));}
 add.onclick=()=>task(async()=>{if(!/^[A-Za-z0-9_-]{8,16}$/.test(id.value))throw Error('Use an existing saved experiment ID.');const response=await fetchImpl('/api/world-experiments/'+id.value,{cache:'no-store'});if(!response.ok)throw Error(`Checkpoint unavailable (${response.status}); missing or access denied.`);const step=await anchorRecord(await response.json(),description.value);if(disposed)return;steps.push(step);status.textContent='Pinned saved checkpoint and pose added.';});
 play.onclick=()=>task(()=>go(index));previous.onclick=()=>task(()=>go(Math.max(0,index-1)));next.onclick=()=>task(()=>go(Math.min(steps.length-1,index+1)));
 reverse.onclick=()=>{steps=steps.slice().reverse();index=steps.length-1-index;status.textContent='Route reversed. Play visits the selected stop; Skip follows the reversed route.';render();};
 rights.onchange=render;
 exportButton.onclick=()=>task(async()=>{if(!rights.checked)throw Error('Explicit sharing rights confirmation is required.');const r=recipe();for(const step of r.steps)await resolveStep(step,fetchImpl);if(disposed)return;json.value=JSON.stringify(r);status.textContent='Read-only recipe ready to copy. No publication or upload occurred. Copies cannot be remotely revoked.';});
 load.onclick=()=>task(async()=>{if(json.value.length>20000)throw Error('Tour recipe is too large.');const r=validateRecipe(JSON.parse(json.value));steps=r.steps;title.value=r.title;guest=true;index=0;status.textContent='Read-only guest recipe loaded. Play validates each checkpoint before reopening.';});
 clear.onclick=()=>{if(busy)return;disposed=true;steps=[];invalid.clear();json.value='';description.value='';title.value='My city tour';id.value='';rights.checked=false;guest=false;index=0;busy=false;doc.defaultView.history.replaceState(null,'',doc.defaultView.location.pathname+doc.defaultView.location.search);status.textContent='Local tour deleted. Shared copies and source checkpoints remain.';render();disposed=false;};
 try{const carried=readTour(doc.defaultView.location.hash);if(carried){steps=carried.recipe.steps;title.value=carried.recipe.title;index=carried.index;guest=true;root.open=true;pause();status.textContent='Validating pinned stop…';void task(async()=>{const step=steps[index];try{await resolveStep(step,fetchImpl);}catch(e){invalid.set(step,e.message);throw e;}if(!restored||loadedRecord?.id!==step.id||loadedRecord?.checksum!==step.checksum)throw Error('Pinned checkpoint was not restored. Use Play to reopen it.');status.textContent=`Stop ${index+1}/${steps.length}: saved checkpoint restored. ${step.source}. Narrative descriptions are user interpretation.`;});}}catch(e){status.textContent='Invalid tour: '+e.message;}
 root.querySelectorAll('button').forEach(b=>b.type='button');container.append(root);render();return {dispose(){disposed=true;root.remove();}};
}
