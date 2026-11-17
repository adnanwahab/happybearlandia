import {cameraObstacles,planCameraPreset} from './camera-presets.js';
const normalize=value=>String(value??'').normalize('NFKC').trim().toLocaleLowerCase();
/** Loaded geometry only. IDs and coordinates remain owned by the town/streamer. */
export function searchPlaces(buildings,query){
 const q=normalize(query);if(!q)return [];
 return buildings.filter(b=>b.mesh?.visible!==false&&b.id!=null&&b.center?.every(Number.isFinite)&&b.center.length===2).map(b=>{
  const address=b.address?.label??'',name=b.name??'',label=name||address||`${b.kind??'Building'} ${b.id}`;
  const terms=[name,address,String(b.id)].map(normalize);
  return {id:b.id,label,address,kind:b.kind??'building',center:[...b.center],exact:terms.includes(q),matches:terms.some(t=>t.includes(q))};
 }).filter(b=>b.matches).sort((a,b)=>Number(b.exact)-Number(a.exact)||a.label.localeCompare(b.label)||String(a.id).localeCompare(String(b.id))).slice(0,30);
}
export function confirmedPlacePose(buildings,preview){
 const current=buildings.find(b=>b.id===preview.id);
 if(!current||current.center?.some((n,i)=>n!==preview.center[i]))return null;
 return planCameraPreset('rooftop',{x:current.center[0],y:0,z:current.center[1]},cameraObstacles(buildings));
}
export function mountPlaceSearch({container,camera,controls,getBuildings,stopGuidance=()=>{}}){
 const doc=container.ownerDocument,root=doc.createElement('details');root.dataset.testid='place-search';
 root.innerHTML='<summary>Find a place</summary><form><label>Building name, address or ID <input type="search" maxlength="200" required></label><button>Search</button></form><p role="status" aria-live="polite">Search loaded places only. No external address geocoding. Names and addresses use loaded metadata; world positions are model coordinates, not geocoded addresses.</p><div data-results></div><p data-preview></p><button type="button" data-confirm disabled>Move camera here</button><button type="button" data-cancel>Cancel preview</button><style>[data-testid="place-search"]{max-width:min(320px,80vw);max-height:55vh;overflow:auto;padding:6px;background:#14292f;color:white}[data-testid="place-search"] button,[data-testid="place-search"] input{min-height:44px;max-width:100%}[data-testid="place-search"] :focus-visible{outline:3px solid #ffe083;outline-offset:2px}</style>';
 const input=root.querySelector('input'),status=root.querySelector('[role=status]'),results=root.querySelector('[data-results]'),preview=root.querySelector('[data-preview]'),confirm=root.querySelector('[data-confirm]');
 let chosen=null,disposed=false;const stats={queries:0,lastQueryMs:0,confirmations:0,frameSamples:0,maxFrameGapMs:0};
 function clear(){chosen=null;preview.textContent='';confirm.disabled=true;}
 root.querySelector('form').onsubmit=event=>{event.preventDefault();clear();results.replaceChildren();const start=performance.now();try{
 const matches=searchPlaces(getBuildings(),input.value);stats.queries++;stats.lastQueryMs=performance.now()-start;
 status.textContent=matches.length?`${matches.length} matches (up to 30). Choose one to preview; duplicate names retain separate IDs.`:'No loaded match. This address or place may be unsupported; no location was inferred.';
 for(const place of matches){const button=doc.createElement('button');button.type='button';button.textContent=`${place.exact?'Exact · ':''}${place.label} · ${place.address} · ${place.kind} · ${place.id}`;button.onclick=()=>{chosen=place;preview.textContent=`Preview: ${place.label} · ${place.id}. Loaded world position ${place.center.join(', ')}. Camera only; selection stays unchanged. Movement is an immediate cut.`;confirm.disabled=false;};results.append(button);}
 }catch{status.textContent='Loaded place index unavailable. Try again.';}};
 confirm.onclick=()=>{if(disposed||!chosen)return;try{const pose=confirmedPlacePose(getBuildings(),chosen);if(!pose){status.textContent='Place changed or no safe camera position is available. Search again.';clear();return;}stopGuidance();const damping=controls.enableDamping;controls.enableDamping=false;controls.update();camera.position.set(pose.position.x,pose.position.y,pose.position.z);controls.target.set(pose.target.x,pose.target.y,pose.target.z);controls.update();controls.enableDamping=damping;stats.confirmations++;status.textContent='Camera moved. Selection preserved. Instant movement also supports reduced motion.';clear();}catch{status.textContent='Camera move unavailable. Search again.';clear();}};
 const cancel=()=>{clear();input.focus();};root.querySelector('[data-cancel]').onclick=cancel;
 const key=e=>{if(e.key==='Escape'){cancel();root.open=false;root.querySelector('summary').focus();}};root.addEventListener('keydown',key);container.append(root);
 let lastFrame=null;
 return {stats,update(now){if(disposed||!root.open){lastFrame=null;return;}if(lastFrame!==null){stats.frameSamples++;stats.maxFrameGapMs=Math.max(stats.maxFrameGapMs,now-lastFrame);}lastFrame=now;},dispose(){disposed=true;root.removeEventListener('keydown',key);root.remove();}};
}
