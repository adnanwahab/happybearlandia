/** Read-only projection. Rendering never creates interactions or advances time. */
export function cityHeatmap(model) {
 const minute=model.minute, places=new Map(model.locations.map(p=>[p.id,p]));
 const homes=new Map();
 for(let i=0;i<model.people.age.length;i++){
  const location=model.people.homeLocation[i],key=model.locations[location]?`location:${location}`:`district:${model.people.home[i]}`;homes.set(key,(homes.get(key)||0)+1);
 }
 const occupancy=[...homes].map(([key,count])=>{const [kind,index]=key.split(':'),place=kind==='location'?model.locations[index]:model.districts[index];return {id:`${kind}:${place.id}`,x:place.x,z:place.z,count,representedCount:count*model.weight};});
 const activity=new Map();let unmapped=0;
 for(const event of model.hotspots?.encounters??[]){
  if(event.minute<=minute-30||event.minute>minute)continue;
  const place=places.get(event.placeId);if(!place){unmapped++;continue;}
  const row=activity.get(event.placeId)??{id:event.placeId,x:place.x,z:place.z,count:0};row.count++;activity.set(row.id,row);
 }
 return {version:'city-heatmap.v1',minute,tick:model.tick,seed:model.seed,fromMinute:Math.max(0,minute-30),occupancy,activity:[...activity.values()],unmapped,retentionLimit:120};
}

export function mountCityHeatmap(container){
 const doc=container.ownerDocument,root=doc.createElement('section');root.setAttribute('aria-label','City heatmap');
 root.innerHTML='<h3>City heatmap</h3><label>Measure <select aria-label="Heatmap measure"><option value="occupancy">Residential occupancy</option><option value="activity">Recorded interactions</option></select></label><p role="status"></p><svg viewBox="0 0 320 200" role="img" aria-label="Schematic city heatmap" style="width:100%;background:#14252d"></svg><p>Model coordinates; synthetic residents. Circle intensity = count / largest count in this measure at this timestamp. Interaction records retain at most 120 encounters citywide; counts may be incomplete. Each encounter counts once, without population weighting.</p>';
 container.append(root);let frame=null;const select=root.querySelector('select'),status=root.querySelector('[role=status]'),svg=root.querySelector('svg');
 function render(){svg.replaceChildren();if(!frame){status.textContent='Heatmap unavailable in this snapshot.';return;}
 const key=select.value,rows=frame[key],max=Math.max(0,...rows.map(r=>r.count)),total=rows.reduce((s,r)=>s+r.count,0),all=[...frame.occupancy,...frame.activity];
 const xs=all.map(r=>r.x),zs=all.map(r=>r.z),minX=Math.min(...xs),minZ=Math.min(...zs),width=Math.max(1,Math.max(...xs)-minX),depth=Math.max(1,Math.max(...zs)-minZ);
 status.textContent=`Minute ${frame.minute} · tick ${frame.tick} · ${total} ${key==='occupancy'?'synthetic residents':'recorded encounters'} · ${rows.length} locations · maximum ${max}${key==='occupancy'?` · ${rows.reduce((s,r)=>s+r.representedCount,0)} represented residents`:` · window (${frame.fromMinute}, ${frame.minute}] · ${frame.unmapped} unmapped`}`;
 for(const row of rows){const circle=doc.createElementNS('http://www.w3.org/2000/svg','circle');for(const [name,value]of Object.entries({cx:15+290*(row.x-minX)/width,cy:15+170*(row.z-minZ)/depth,r:10,fill:'#ff9b42','fill-opacity':row.count/max}))circle.setAttribute(name,String(value));const title=doc.createElementNS(svg.namespaceURI,'title');title.textContent=`${row.id}: ${row.count}`;circle.append(title);svg.append(circle);}
 }
 select.addEventListener('change',render);return{update(snapshot){frame=snapshot?.cityHeatmap??null;render();},destroy(){select.removeEventListener('change',render);root.remove();}};
}
