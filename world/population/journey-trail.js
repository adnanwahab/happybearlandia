/** Session-only observations of received Population frames. Never reconstruct motion. */
export function createJourneyTrail(){
 let personId=null,scope=null,samples=[],last=null,broken=true;
 function clear(){scope=null;samples=[];last=null;broken=true;}
 return {
  select(id){id=id==null?null:String(id);if(id!==personId){personId=id;clear();}},
  clear,
  observe(frame){
   const r=frame?.runtime,minute=frame?.minute,row=frame?.visibleAgents?.find(p=>String(p.id)===personId),trip=row?.trip;
   if(!r?.id||!Number.isInteger(r.revision)||!Number.isFinite(minute)||!Number.isInteger(r.tick)||r.tick<0||!Number.isInteger(r.stepMinutes)||r.stepMinutes<=0||minute!==r.tick*r.stepMinutes||!frame.modelVersion){clear();return;}
   if(last&&(last.id!==r.id||last.revision!==r.revision||minute<last.minute||r.tick<last.tick))clear();
   const duplicate=last&&r.tick===last.tick&&minute===last.minute;
   const adjacent=last&&r.tick===last.tick+1&&minute===last.minute+r.stepMinutes;
   last={id:r.id,revision:r.revision,tick:r.tick,minute};
   samples=samples.filter(s=>minute-s.minute<=30);if(samples.length)samples[0].connected=false;
   if(!trip){broken=true;return;}
   if(trip.departureMinute>minute||!(trip.remainingMinutes>0)||trip.schemaVersion!=='population-current-trip.v1'||![trip.departureMinute,trip.from?.x,trip.from?.z,trip.to?.x,trip.to?.z].every(Number.isFinite)){clear();return;}
   const key=JSON.stringify([r.id,r.revision,frame.modelVersion,personId,trip.departureMinute,trip.from,trip.to]);
   if(scope!==key){samples=[];scope=key;broken=true;}
   if(!Number.isFinite(row.x)||!Number.isFinite(row.z)){broken=true;return;}
   if(duplicate&&samples.at(-1)?.minute===minute)return;
   samples.push({personId,runId:r.id,revision:r.revision,modelVersion:frame.modelVersion,seed:frame.config?.seed,tick:r.tick,minute,x:row.x,z:row.z,departureMinute:trip.departureMinute,geometry:trip.geometry,connected:!broken&&Boolean(adjacent)});
   samples=samples.slice(-32);if(samples.length)samples[0].connected=false;broken=false;
  },
  getSamples(){return samples.map(s=>({...s}));}
 };
}

export function mountJourneyTrail({container,scene,THREE}){
 const doc=container.ownerDocument,store=createJourneyTrail(),panel=doc.createElement('section');panel.dataset.testid='journey-trail';
 const title=doc.createElement('h4'),note=doc.createElement('p'),buttons=doc.createElement('div'),reading=doc.createElement('output');
 title.textContent='Recent journey frames';note.textContent='Recorded synthetic Population positions received while selected · last 30 model minutes, at most 32 frames. Gaps stay empty; connecting strokes are schematic, not recorded routes.';
 buttons.style.cssText='display:flex;flex-wrap:wrap;gap:4px';reading.style.display='block';reading.style.overflowWrap='anywhere';panel.append(title,note,buttons,reading);container.append(panel);
 const group=new THREE.Group();group.name='selected-journey-trail';scene.add(group);
 const lineGeo=new THREE.BufferGeometry(),pointGeo=new THREE.BufferGeometry(),lineMat=new THREE.LineBasicMaterial({color:0x70eaff,transparent:true,opacity:.65,depthTest:false}),pointMat=new THREE.PointsMaterial({color:0x70eaff,size:7,sizeAttenuation:false,depthTest:false});
 lineGeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(31*6),3));pointGeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(32*3),3));
 const line=new THREE.LineSegments(lineGeo,lineMat),points=new THREE.Points(pointGeo,pointMat),marker=new THREE.Mesh(new THREE.SphereGeometry(.8,12,8),new THREE.MeshBasicMaterial({color:0xffdf70,depthTest:false}));
 for(const object of [line,points,marker]){object.renderOrder=25;group.add(object);}marker.visible=false;
 let chosen=null,signature='',active=false;
 function inspect(sample){chosen=sample.tick;reading.textContent=`Minute ${sample.minute} · tick ${sample.tick} · x ${sample.x}, z ${sample.z} · resident ${sample.personId} · run ${sample.runId} revision ${sample.revision} · seed ${sample.seed??'unavailable'} · ${sample.modelVersion} · ${sample.geometry??'geometry unavailable'}`;marker.position.set(sample.x,1.5,sample.z);marker.visible=true;for(const button of buttons.children)button.setAttribute('aria-pressed',String(Number(button.dataset.tick)===chosen));}
 function draw(){
  const samples=store.getSamples(),next=JSON.stringify(samples);if(next===signature)return;signature=next;
  const coords=[],segments=[];samples.forEach((s,i)=>{coords.push(s.x,1.5,s.z);if(i&&s.connected){const p=samples[i-1];segments.push(p.x,1.5,p.z,s.x,1.5,s.z);}});
  lineGeo.attributes.position.array.fill(0);pointGeo.attributes.position.array.fill(0);lineGeo.attributes.position.array.set(segments);pointGeo.attributes.position.array.set(coords);lineGeo.attributes.position.needsUpdate=true;pointGeo.attributes.position.needsUpdate=true;lineGeo.setDrawRange(0,segments.length/3);pointGeo.setDrawRange(0,coords.length/3);lineGeo.computeBoundingSphere();pointGeo.computeBoundingSphere();
  // Reuse controls at each committed tick so keyboard focus survives updates.
  const retained=new Map([...buttons.children].map(b=>[Number(b.dataset.tick),b]));
  for(const b of [...buttons.children])if(!samples.some(s=>s.tick===Number(b.dataset.tick)))b.remove();
  for(const sample of samples){let b=retained.get(sample.tick);if(!b){b=doc.createElement('button');b.type='button';b.dataset.tick=sample.tick;b.textContent=`Minute ${sample.minute}`;b.style.minHeight='44px';buttons.append(b);}b.onclick=()=>inspect(sample);}
  if(samples.length)inspect(samples.find(s=>s.tick===chosen)??samples.at(-1));else{marker.visible=false;reading.textContent='Journey positions unavailable. Select a supported traveling resident and wait for committed frames; no prehistory is reconstructed.';}
 }
 draw();
 return {select(id,frame){store.select(id);store.observe(frame);draw();},observe(frame){store.observe(frame);draw();},clear(){store.clear();signature='';draw();},setActive(value){active=Boolean(value);group.visible=active;panel.hidden=!active;if(!active){store.select(null);signature='';draw();}},destroy(){scene.remove(group);lineGeo.dispose();pointGeo.dispose();lineMat.dispose();pointMat.dispose();marker.geometry.dispose();marker.material.dispose();panel.remove();}};
}
