// Presentation only. Constant roof-clear altitude and convex rectangular bounds
// make every linear segment safe, not just its endpoints. No routing/time claim.
export function planStreetJourney(road,bounds,buildings=[]) {
 if(!bounds||!['minX','maxX','minZ','maxZ'].every(k=>Number.isFinite(bounds[k]))||bounds.minX>=bounds.maxX||bounds.minZ>=bounds.maxZ)return null;
 const pts=road?.pts;
 if(!Array.isArray(pts)||pts.length<2||pts.length>2048||pts.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<bounds.minX||p[0]>bounds.maxX||p[1]<bounds.minZ||p[1]>bounds.maxZ))return null;
 if(buildings.some(b=>b.kind!=='park'&&!Number.isFinite(b.height)))return null;
 const y=Math.max(40,...buildings.filter(b=>b.kind!=='park').map(b=>b.height+12));
 if(y>1100)return null;
 const points=pts.map(([x,z])=>({x,y,z})),lengths=[0];
 for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z));
 return lengths.at(-1)>1?{points,lengths,total:lengths.at(-1)}:null;
}
export function journeyPose(plan,fraction){
 const distance=Math.max(0,Math.min(1,fraction))*plan.total;let i=1;
 while(i<plan.points.length-1&&plan.lengths[i]<distance)i++;
 const a=plan.points[i-1],b=plan.points[i],t=(distance-plan.lengths[i-1])/(plan.lengths[i]-plan.lengths[i-1]||1);
 const position={x:a.x+(b.x-a.x)*t,y:a.y,z:a.z+(b.z-a.z)*t};
 return {position,target:{x:position.x,y:0,z:position.z+.01}};
}
export function mountStreetJourney({container,canvas,camera,controls,getData,stopGuidance=()=>{},reducedMotion=()=>false}){
 const doc=container.ownerDocument,root=doc.createElement('details');root.dataset.testid='street-journey';
 root.innerHTML='<summary>Street journey</summary><label>Loaded street <select aria-label="Loaded street"></select></label><button type="button">Journey</button><button type="button">Skip</button><button type="button">Back</button><p role="status">Visual street preview only; no service route or travel time.</p>';
 root.style.cssText='max-width:290px;padding:6px';const select=root.querySelector('select'),[start,skip,back]=root.querySelectorAll('button'),status=root.querySelector('p');
 for(const button of [start,skip,back])button.style.cssText='min-height:44px;min-width:44px';
 const data=getData(),roads=(data.roads||[]).slice(0,100);for(const [i,r]of roads.entries()){const option=doc.createElement('option');option.value=i;option.textContent=String(r.name||`Street ${i+1}`).slice(0,80);select.append(option);}
 if(!roads.length){const option=doc.createElement('option');option.textContent='No street geometry';select.append(option);}
 let saved=null,active=null,disposed=false;skip.disabled=back.disabled=true;
 const snapshot=()=>({position:{...camera.position},target:{...controls.target}});
 function apply(pose){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();for(const key of ['position','target']){const v=pose[key];(key==='position'?camera.position:controls.target).set(v.x,v.y,v.z);}controls.update();controls.enableDamping=damping;}
 function stop(){active=null;skip.disabled=true;}
 function safe(){if(!active)return false;const d=getData(),p=planStreetJourney(d.roads?.[active.index],d.bounds,d.buildings);return p&&JSON.stringify(p)===JSON.stringify(active.plan);}
 function finish(){if(!active)return;if(!safe()){stop();status.textContent='Journey stopped: street geometry or bounds changed.';return;}apply(journeyPose(active.plan,1));stop();status.textContent='Arrived at street end. Visual preview only; no travel-time estimate.';}
 start.onclick=()=>{stop();stopGuidance();saved??=snapshot();back.disabled=false;const current=getData(),plan=planStreetJourney(current.roads?.[Number(select.value)],current.bounds,current.buildings);
 if(!plan){status.textContent='Street route unavailable. Camera cut only.';const b=current.bounds;if(b&&['minX','maxX','minZ','maxZ'].every(k=>Number.isFinite(b[k]))){const cut=planStreetJourney({pts:[[b.minX,b.minZ],[b.maxX,b.maxZ]]},b,current.buildings);if(cut)apply(journeyPose(cut,1));}return;}
 apply(journeyPose(plan,0));status.textContent=`${current.source==='osm'?'Loaded map':'Synthetic'} street geometry preview; no transit service or travel-time claim.`;
 if(reducedMotion()){apply(journeyPose(plan,1));status.textContent+=' Reduced motion: camera cut.';return;}
 active={plan,index:Number(select.value),start:null};skip.disabled=false;};
 skip.onclick=finish;back.onclick=()=>{stop();if(saved){const buildings=getData().buildings||[],p=saved.position;if(!Number.isFinite(p.y)||p.y<3||p.y>1200||buildings.some(b=>b.kind!=='park'&&b.poly?.length&&(!Number.isFinite(b.height)||p.y<=b.height+3&&p.x>=Math.min(...b.poly.map(v=>v[0]))-3&&p.x<=Math.max(...b.poly.map(v=>v[0]))+3&&p.z>=Math.min(...b.poly.map(v=>v[1]))-3&&p.z<=Math.max(...b.poly.map(v=>v[1]))+3))){status.textContent='Previous view obstructed; use manual camera controls.';return;}stopGuidance();apply(saved);saved=null;back.disabled=true;status.textContent='Returned to previous view.';}};
 const interrupt=()=>{if(active){stop();status.textContent='Journey interrupted. Back restores the previous view.';}};
 const key=e=>{if(e.key==='Escape')interrupt();};doc.addEventListener('keydown',key);canvas.addEventListener('pointerdown',interrupt);canvas.addEventListener('wheel',interrupt,{passive:true});controls.addEventListener('start',interrupt);doc.defaultView.addEventListener('world:local-pan',interrupt);container.append(root);
 return {update(now){if(disposed||!active)return;if(!safe()){stop();status.textContent='Journey stopped: street geometry or bounds changed.';return;}if(reducedMotion()){finish();status.textContent='Reduced motion: camera cut.';return;}active.start??=now;const t=(now-active.start)/4000;if(t>=1)finish();else apply(journeyPose(active.plan,t));},dispose(){disposed=true;stop();doc.removeEventListener('keydown',key);canvas.removeEventListener('pointerdown',interrupt);canvas.removeEventListener('wheel',interrupt);controls.removeEventListener('start',interrupt);doc.defaultView.removeEventListener('world:local-pan',interrupt);root.remove();}};
}
