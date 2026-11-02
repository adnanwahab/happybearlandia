import {mountConstitutionCityView} from '../constitution-city/views.js';
const finite=Number.isFinite;
const rows=(state,key)=>Array.isArray(state?.[key])?state[key]:[];
const keyOf=row=>String(row.id??row.personId??row.buildingId);
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)&&!ArrayBuffer.isView(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const seedOf=s=>s?.seed??s?.config?.seed??s?.provenance?.seed;
const timeOf=s=>s?.minute??s?.month;
export const unwrapRealityState=value=>value?.snapshot??value?.state??value;
export function realityComparable(baseline,current){baseline=unwrapRealityState(baseline);current=unwrapRealityState(current);
 return !!baseline&&!!current&&seedOf(baseline)!==undefined&&seedOf(baseline)===seedOf(current)&&timeOf(baseline)!==undefined&&timeOf(baseline)===timeOf(current)&&(!(baseline.version&&current.version)||baseline.version===current.version);
}
export function stableRealityChanges(baseline,current,collections=['buildings','parcels','units','links','projects','households','businesses','districts']){
 baseline=unwrapRealityState(baseline);current=unwrapRealityState(current);const result={};for(const collection of collections){const before=new Map(rows(baseline,collection).map(row=>[keyOf(row),row])),after=new Map(rows(current,collection).map(row=>[keyOf(row),row]));result[collection]=[...new Set([...before.keys(),...after.keys()])].map(id=>({id,status:!before.has(id)?'added':!after.has(id)?'removed':canonical(before.get(id))!==canonical(after.get(id))?'changed':'unchanged'})).filter(row=>row.status!=='unchanged');}return result;
}
export function populationRealityDiff(baseline,current){
 baseline=unwrapRealityState(baseline);current=unwrapRealityState(current);const before=new Map(rows(baseline,'visibleAgents').map(p=>[keyOf(p),p])),after=new Map(rows(current,'visibleAgents').map(p=>[keyOf(p),p]));
 // A changing sample is not a birth/death/migration ledger.
 const people=[];for(const [id,p]of after){if(before.has(id)&&canonical(p)!==canonical(before.get(id)))people.push({id,status:'changed'});}
 return{people,unpairedSampleIds:[...new Set([...before.keys(),...after.keys()])].filter(id=>!before.has(id)||!after.has(id)),occupancy:stableRealityChanges(baseline,current,['buildingOccupancy']).buildingOccupancy,limitations:['Only stable IDs present in both bounded person samples are compared; missing sample IDs do not imply added or removed people.','District capacity changes are coarse model inputs/outputs, not evidence of physical construction.']};
}
export function recordedProjectRows(state,events=[],decisions=[]){
 return rows(state,'projects').map(project=>{
  const records=[...events,...decisions].filter(row=>String(row.projectId??row.payload?.projectId??'')===String(project.id));
  const reason=records.filter(row=>row.reason??row.payload?.reason).at(-1);
  const assigned=Array.isArray(project.assignedWorkerIds)?project.assignedWorkerIds.length:finite(project.workerCount)?project.workerCount:null;
  return{id:project.id,stage:project.stage??'Not recorded',progress:finite(project.progress)?project.progress:null,duration:finite(project.duration)?project.duration:null,reason:reason?.reason??reason?.payload?.reason??project.blockedReason??project.bottleneck??null,reasonType:reason?.eventType??reason?.type??null,assignedWorkers:assigned};
 });
}
export function populationWorldGeometry(context={}){
 const origin=context.origin||{},lat=origin.lat??0,lng=origin.lng??0,project=([x,y])=>[(x-lng)*111320*Math.cos(lat*Math.PI/180),-(y-lat)*110540];
 return rows(context,'buildings').map(b=>{
  const ring=b.geometry?.type==='Polygon'?b.geometry.coordinates?.[0]:null;
  const poly=Array.isArray(b.poly)&&b.poly.length>=3?b.poly:ring?.length>=3?ring.map(project):null;
  const center=Array.isArray(b.center)?b.center:finite(b.x)&&finite(b.z)?[b.x,b.z]:poly?poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]):null;
  return{id:String(b.id),poly,center,source:b.source??(poly?'supplied footprint':'supplied point anchor')};
 }).filter(b=>b.center?.every(finite));
}
/** One view per comparison pane. Parent synchronizes the same pose between panes.
 * City states reuse the existing 3D view. Population states use only supplied
 * footprints/anchors and <=500 actual sampled positions, never generated people.
 */
export function mountRealityWorldView(container,{onCameraChange,onSelect}={}){
 if(!container?.ownerDocument)throw Error('Reality view requires a container');
 const doc=container.ownerDocument,win=doc.defaultView,root=doc.createElement('section');root.className='reality-world-view';
 const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./world-views.css',import.meta.url).href;(doc.head||container).append(sheet);
 const caption=doc.createElement('p'),viewport=doc.createElement('div'),records=doc.createElement('section');caption.className='reality-world-caption';caption.setAttribute('role','status');viewport.className='reality-world-scene';records.className='reality-project-records';root.append(caption,viewport,records);container.append(root);
 let destroyed=false,payload=null,engine=null,city=null,svg=null,pose=null,initialized=false,drag=null,dragMoved=false,stats={engine:null,objects:0};
 const svgNode=(tag,attrs,parent=svg)=>{const node=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))node.setAttribute(k,String(v));parent.append(node);return node;};
 function validPose(value){return value&&[value.position,value.target].every(a=>Array.isArray(a)&&a.length===3&&a.every(n=>finite(n)&&Math.abs(n)<1e6))&&value.position[1]>0;}
 function applyPose(){if(!svg||!pose)return;const span=pose.position[1],aspect=Math.max(.2,(viewport.clientWidth||500)/(viewport.clientHeight||360));svg.setAttribute('viewBox',[pose.target[0]-span*aspect/2,pose.target[2]-span/2,span*aspect,span].join(' '));}
 function notifyPose(){applyPose();onCameraChange?.(structuredClone(pose));}
 function pointerDown(event){if(!pose)return;dragMoved=false;drag={x:event.clientX,y:event.clientY,pose:structuredClone(pose)};svg.setPointerCapture?.(event.pointerId);}
 function pointerMove(event){if(!drag)return;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>3)dragMoved=true;const units=drag.pose.position[1]/Math.max(1,viewport.clientHeight);pose.target[0]=drag.pose.target[0]-(event.clientX-drag.x)*units;pose.target[2]=drag.pose.target[2]-(event.clientY-drag.y)*units;pose.position[0]=pose.target[0];pose.position[2]=pose.target[2];notifyPose();}
 const pointerUp=()=>{drag=null;};
 function wheel(event){event.preventDefault();pose.position[1]=Math.max(5,Math.min(20000,pose.position[1]*Math.exp(Math.max(-1,Math.min(1,event.deltaY/500)))));notifyPose();}
 function pick(event){if(dragMoved)return;const node=event.target.closest?.('[data-reality-entity]');if(!node)return;const [kind,id]=JSON.parse(node.dataset.realityEntity);const state=unwrapRealityState(payload.state);const record=kind==='person'?rows(state,'visibleAgents').find(p=>keyOf(p)===id):populationWorldGeometry(payload.worldContext).find(b=>b.id===id);onSelect?.({engine:'population',kind,id,record});}
 function createPopulationCanvas(){svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('role','img');svg.setAttribute('aria-label','Recorded population positions and supplied building geometry');svg.tabIndex=0;viewport.append(svg);svg.addEventListener('pointerdown',pointerDown);svg.addEventListener('pointermove',pointerMove);svg.addEventListener('pointerup',pointerUp);svg.addEventListener('pointercancel',pointerUp);svg.addEventListener('wheel',wheel,{passive:false});svg.addEventListener('click',pick);}
 function clearView(){city?.destroy();city=null;if(svg){svg.removeEventListener('pointerdown',pointerDown);svg.removeEventListener('pointermove',pointerMove);svg.removeEventListener('pointerup',pointerUp);svg.removeEventListener('pointercancel',pointerUp);svg.removeEventListener('wheel',wheel);svg.removeEventListener('click',pick);svg.remove();svg=null;}initialized=false;}
 function projects(state){
  records.replaceChildren();const heading=doc.createElement('h3');heading.textContent='Recorded construction';records.append(heading);const capacityKeys=['contractors','labor','materials','equipment','permits'].filter(key=>finite(state.parameters?.[key]));if(capacityKeys.length){const p=doc.createElement('p');p.textContent='Recorded capacity inputs (not worker headcounts): '+capacityKeys.map(key=>key+' '+state.parameters[key]).join(' · ');records.append(p);}const all=recordedProjectRows(state,payload.events??[],payload.decisions??[]);
  if(!all.length){const p=doc.createElement('p');p.textContent=engine==='population'?'No physical construction ledger is supplied for this population snapshot. Housing/service capacity is coarse; no new buildings are inferred.':'No project records were supplied at this selected month.';records.append(p);return;}
  const table=doc.createElement('table'),head=doc.createElement('tr');for(const name of ['Project','Stage','Progress / duration','Recorded bottleneck','Assigned workers']){const cell=doc.createElement('th');cell.textContent=name;head.append(cell);}table.append(head);
  for(const row of all.slice(0,24)){const tr=doc.createElement('tr');for(const value of [row.id,row.stage,row.progress===null?'Unavailable':String(row.progress)+(row.duration===null?'':' / '+row.duration),row.reason===null?'Not recorded':(row.reasonType?row.reasonType+': ':'')+row.reason,row.assignedWorkers===null?'Not recorded':row.assignedWorkers]){const td=doc.createElement('td');td.textContent=String(value);tr.append(td);}table.append(tr);}records.append(table);
  const note=doc.createElement('p');note.textContent='Showing '+Math.min(24,all.length)+' of '+all.length+' supplied projects. Workforce counts require explicit assignments; labor capacity is not a worker headcount.';records.append(note);
 }
 function drawPopulation(state,baseline,comparable){
  svg.replaceChildren();const geometry=populationWorldGeometry(payload.worldContext),agents=rows(state,'visibleAgents').slice(0,500).filter(p=>finite(p.x)&&finite(p.z)),diff=comparable?populationRealityDiff(baseline,state):{people:[],occupancy:[],unpairedSampleIds:[]},changedPeople=new Set(diff.people.map(p=>p.id)),changedBuildings=new Set(diff.occupancy.map(b=>b.id)),occupancy=new Map(rows(state,'buildingOccupancy').map(b=>[String(b.buildingId),b.count]));
  const coords=[...geometry.map(b=>b.center),...agents.map(p=>[p.x,p.z])];
  if(!initialized&&coords.length){const xs=coords.map(p=>p[0]),zs=coords.map(p=>p[1]);pose=pose??{target:[(Math.min(...xs)+Math.max(...xs))/2,0,(Math.min(...zs)+Math.max(...zs))/2],position:[0,Math.max(50,Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs))*1.2,0]};initialized=true;}
  pose??={position:[0,300,0],target:[0,0,0]};applyPose();
  for(const b of geometry){const changed=changedBuildings.has(b.id),node=b.poly?svgNode('polygon',{points:b.poly.map(p=>p.join(',')).join(' '),fill:changed?'#e4aa69':'#b5c7c1',stroke:changed?'#a74b22':'#53796c','stroke-width':1,'vector-effect':'non-scaling-stroke'}):svgNode('circle',{cx:b.center[0],cy:b.center[1],r:3,fill:changed?'#e09e55':'#7b9690'});node.dataset.realityEntity=JSON.stringify(['building',b.id]);const title=svgNode('title',{},node);title.textContent=b.id+' · '+(b.poly?'supplied footprint':'point anchor; footprint unavailable')+' · occupancy '+(occupancy.has(b.id)?occupancy.get(b.id):'unavailable');}
  for(const p of agents){const id=keyOf(p),node=svgNode('circle',{cx:p.x,cy:p.z,r:1.8,fill:changedPeople.has(id)?'#d86633':'#245ec0',stroke:'#ffffff','stroke-width':.5,'vector-effect':'non-scaling-stroke'});node.dataset.realityEntity=JSON.stringify(['person',id]);const title=svgNode('title',{},node);title.textContent=id+' · '+(p.currentActivity??p.activity??'activity unavailable');}
  stats={engine:'population',minute:state.minute,seed:seedOf(state),renderedAgents:agents.length,suppliedAgents:rows(state,'visibleAgents').length,footprints:geometry.filter(b=>b.poly).length,pointAnchors:geometry.filter(b=>!b.poly).length,changedPersonIds:[...changedPeople],changedOccupancyIds:[...changedBuildings],unpairedSampleIds:diff.unpairedSampleIds,comparisonComparable:comparable,physicalCapacityConstructionInferred:false};
  caption.textContent='Entered recorded population snapshot · minute '+(state.minute??payload.minute??'unavailable')+' · seed '+(seedOf(state)??'unavailable')+' · '+agents.length+' sampled people. Orange marks matched recorded differences. Missing sample IDs are not births/deaths. '+(comparable?'':'Comparable baseline identity/time is unavailable; differences withheld. ')+'Coarse district capacity does not create physical buildings.';
 }
 const api={
  update(next){if(destroyed)return;payload={...next,events:next?.events??next?.state?.events,decisions:next?.decisions??next?.state?.decisions};const state=unwrapRealityState(next?.state);if(!state){clearView();engine=null;stats={engine:null,objects:0};records.replaceChildren();caption.textContent='Enter an actual replayed future to display a world.';return;}const nextEngine=next.engine??(Array.isArray(state.visibleAgents)?'population':'city');if(nextEngine!==engine){clearView();engine=nextEngine;if(engine==='population')createPopulationCanvas();else city=mountConstitutionCityView(viewport,{onCameraChange,onSelect:selection=>onSelect?.({...selection,engine:'city'})});}
   const baseline=unwrapRealityState(next.baselineState),comparable=realityComparable(baseline,state);
   if(engine==='population')drawPopulation(state,baseline,comparable);else{const changes=comparable?stableRealityChanges(baseline,state):{},diff={...(next.analysis??{}),changes};city.update({state,baselineState:comparable?baseline:null,diff,mode:next.mode??'after',month:next.month??state.month});if(pose)city.setCamera(pose);stats={engine:'city',month:state.month,seed:seedOf(state),comparisonComparable:comparable,changedBuildingIds:(changes.buildings??[]).map(b=>b.id),projectRecords:rows(state,'projects').length};caption.textContent='Entered recorded city state · month '+(state.month??next.month??'unavailable')+' · seed '+(seedOf(state)??'unavailable')+'. '+(comparable?'Stable-ID model differences are highlighted.':'Baseline period/identity unavailable; comparative highlights withheld.')+' Supplied footprints locate buildings; district systems remain coarse and synthetic.';}projects(state);
  },
  getCamera(){return city?.getCamera?.()??(pose?structuredClone(pose):null);},
  setCamera(value){if(!validPose(value))return;pose=structuredClone(value);if(city)city.setCamera(pose);else applyPose();},
  getStats(){return{...stats,...(city?{cityView:city.getStats()}:{} )};},
  destroy(){if(destroyed)return;destroyed=true;clearView();root.remove();sheet.remove();}
 };
 return api;
}
