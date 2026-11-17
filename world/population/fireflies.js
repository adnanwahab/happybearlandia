import {pointOnPedestrianRoute} from './pedestrian-routes.js';
export const FIREFLY_CAP=160;
/** Read-only committed-frame projection. Inclusion probabilities are unknown for
 * the camera-prioritized worker sample; representation is not sampling weight. */
export function tripFireflies(frame, cap=FIREFLY_CAP){
 const valid=[];
 const seen=new Set();
 for(const row of (frame?.visibleAgents||[]).slice(0,2000)){
  const t=row?.trip,r=t?.route;
  if(!row?.id||seen.has(row.id)||t?.schemaVersion!=='population-current-trip.v1'||!(t.remainingMinutes>0)||!Number.isFinite(t.departureMinute)||!Number.isFinite(t.progress)||t.progress<0||t.progress>1||r?.kind!=='mapped-sidewalk'||r.rulesVersion!=='sidewalks.v1'||!Array.isArray(r.points)||r.points.length<2||r.points.length>4096||!r.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))continue;
  const distance=r.points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-r.points[i][0],p[1]-r.points[i][1]),0);
  if(!(distance>0)||!Number.isFinite(r.distanceMetres)||Math.abs(distance-r.distanceMetres)>Math.max(.01,distance*1e-6))continue;
  seen.add(row.id);
  valid.push({personId:row.id,tripKey:JSON.stringify([frame.runtime?.id??null,frame.runtime?.revision??null,row.id,t.departureMinute]),departureMinute:t.departureMinute,position:pointOnPedestrianRoute(r,t.progress),samplingWeight:null,representationWeight:Number.isFinite(row.weight)&&row.weight>0?row.weight:null,routeKind:r.kind,rulesVersion:r.rulesVersion});
 }
 valid.sort((a,b)=>a.tripKey<b.tripKey?-1:a.tripKey>b.tripKey?1:0);
 return {schemaVersion:'population-fireflies.v1',minute:frame?.minute??null,seed:frame?.effectiveConfig?.seed??null,modelVersion:frame?.modelVersion??null,modeledActiveTrips:Number.isSafeInteger(frame?.metrics?.activeTrips)&&frame.metrics.activeTrips>=0?frame.metrics.activeTrips:null,eligibleSample:valid.length,particles:valid.slice(0,Number.isFinite(cap)?Math.max(0,Math.min(FIREFLY_CAP,Math.floor(cap))):0),samplingWeight:null};
}
export function mountTripFireflies({container,controls,getFrame,project,onSelect}){
 const doc=container.ownerDocument,panel=doc.createElement('details'),summary=doc.createElement('summary'),toggle=doc.createElement('input'),label=doc.createElement('label'),status=doc.createElement('p'),receipt=doc.createElement('pre'),overlay=doc.createElement('div');
 panel.id='commuter-fireflies';summary.textContent='Commuter fireflies';toggle.type='checkbox';label.append(toggle,' Show sampled journeys');panel.append(summary,label,status,receipt);controls.append(panel);
 receipt.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px';overlay.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9';container.append(overlay);
 const buttons=[];let latest=null,destroyed=false,updates=0,maxUpdateMs=0,lastFrame=null,maxFrameMs=0,sourceFrame=undefined;
 function update(now){if(destroyed)return;const started=performance.now();const frame=getFrame();if(sourceFrame!==frame){const next=tripFireflies(frame);receipt.textContent='';latest=next;sourceFrame=frame;}const particles=toggle.checked?latest.particles:[];
  const message=`Modeled active trips: ${latest.modeledActiveTrips??'unavailable'} · rendered sample: ${particles.length} / cap ${FIREFLY_CAP}. Synthetic trips; mapped routes use sidewalk assumptions. Glow is decorative. Sampling weights unknown; no population estimate.${frame?'':' Living Population trip source unavailable.'}`;if(status.textContent!==message)status.textContent=message;
  for(let i=0;i<particles.length;i++){
   let b=buttons[i];if(!b){b=doc.createElement('button');b.type='button';b.style.cssText='position:absolute;min-width:24px;min-height:24px;padding:0;border:0;border-radius:50%;background:radial-gradient(circle,#fffbd2 0 12%,#ffe77388 20%,transparent 65%);filter:drop-shadow(0 0 4px #ffe773);pointer-events:auto;color:transparent';b.addEventListener('click',()=>{const p=latest?.particles[i];if(!p)return;receipt.textContent=JSON.stringify({...p,minute:latest.minute,seed:latest.seed,modelVersion:latest.modelVersion},null,2);panel.open=true;onSelect(p.personId);});overlay.append(b);buttons.push(b);}
   const p=particles[i],screen=project(p.position);b.hidden=!screen;b.setAttribute('aria-label',`Inspect source trip ${p.personId}, departure ${p.departureMinute}`);if(screen){b.style.left=`${screen.x-12}px`;b.style.top=`${screen.y-12}px`;}
  }
  for(let i=particles.length;i<buttons.length;i++)buttons[i].hidden=true;
  if(lastFrame!==null)maxFrameMs=Math.max(maxFrameMs,now-lastFrame);lastFrame=now;updates++;maxUpdateMs=Math.max(maxUpdateMs,performance.now()-started);
 }
 const clear=()=>{receipt.textContent='';};toggle.addEventListener('change',clear);
 return {update,getState:()=>({destroyed,updates,maxUpdateMs,maxFrameMs,allocatedMarkers:buttons.length,latest}),destroy(){if(destroyed)return;destroyed=true;toggle.removeEventListener('change',clear);panel.remove();overlay.remove();buttons.length=0;latest=null;}};
}
