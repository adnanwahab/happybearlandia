/** Presentation-only adapter. Never disaggregates cohorts or synthesizes history. */
export function zoomEvidence(frame, districtId) {
 const districts=(frame?.districts||[]).filter(d=>Number.isFinite(d.x)&&Number.isFinite(d.z));
 const residents=(frame?.visibleAgents||[]).filter(p=>p.id!=null&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&districts.some(d=>d.id===p.homeDistrictId)).slice().sort((a,b)=>String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0);
 // Membership is explicit home-district identity, never inferred from position.
 const selected=districts.find(d=>d.id===districtId)??(districtId===undefined?districts.find(d=>d.id===residents[0]?.homeDistrictId):null);
 const representatives=[...new Map(residents.filter(p=>p.homeDistrictId===selected?.id).map(p=>[String(p.id),p])).values()].slice(0,12);
 const person=representatives[0]??null;
 return {districts,representatives,sampleVersion:"home-district-id-order.v1",sampleCount:residents.length,person,district:selected,represented:frame?.metrics?.representedPopulation,synthetic:frame?.metrics?.syntheticPopulation,minute:frame?.minute,modelVersion:frame?.modelVersion,seed:frame?.effectiveConfig?.seed,tick:frame?.tick,run:frame?.runtime?.id};
}
export function zoomProjection(evidence,level) {
 const t=Math.max(0,Math.min(2,level)),district=evidence.district,person=evidence.person,ds=evidence.districts;
 const center={x:ds.reduce((s,d)=>s+d.x,0)/Math.max(1,ds.length),z:ds.reduce((s,d)=>s+d.z,0)/Math.max(1,ds.length)};
 const span=Math.max(100,...ds.map(d=>Math.hypot(d.x-center.x,d.z-center.z)*3));
 const stops=[{...center,span},{x:district?.x??center.x,z:district?.z??center.z,span:span*.4},{x:person?.x??center.x,z:person?.z??center.z,span:30}];
 const i=Math.min(1,Math.floor(t)),u=t-i,s=u*u*(3-2*u),a=stops[i],b=stops[i+1];
 return {x:a.x+(b.x-a.x)*s,z:a.z+(b.z-a.z)*s,span:Math.exp(Math.log(a.span)*(1-s)+Math.log(b.span)*s)};
}
export function mountPopulationZoom({container,onInspect}) {
 const doc=container.ownerDocument,win=doc.defaultView,box=doc.createElement('details');box.className='lc-zoom';
 box.innerHTML='<summary>City → district → resident</summary><canvas width="560" height="260" aria-label="Synthetic population projection"></canvas><label>Cohort Spotlight · home district <select aria-label="Spotlight home district"></select></label><p data-zoom-group role="status"></p><div data-zoom-members></div><p data-zoom-count role="status"></p><label>Scale <input aria-label="Population zoom" type="range" min="0" max="2" step="0.01" value="0"></label><div><button data-zoom-tier="0">City</button><button data-zoom-tier="1">District</button><button data-zoom-tier="2">Resident</button><button data-zoom-inspect>Inspect resident</button></div><p data-zoom-source></p><p>Frozen snapshot · Canvas2D presentation. Circles show district totals, not individual locations. Group IDs are the first 12 sorted IDs mapped to the selected home district in the frozen worker sample. Samples can change with camera, tick or run. Colors, radii and dissolve are decorative; totals are computed synthetic model outputs, not observations. Weighted totals do not establish independently active people. No history or causal effect is generated.</p>';
 box.style.cssText='margin-top:12px;padding:10px;border:1px solid #689784;border-radius:12px';container.append(box);
 const canvas=box.querySelector('canvas'),ctx=canvas.getContext('2d'),slider=box.querySelector('input'),count=box.querySelector('[data-zoom-count]'),inspect=box.querySelector('[data-zoom-inspect]');canvas.style.cssText='width:100%;height:auto;background:#102925;border-radius:8px';
 let evidence=null,latest=null,frozen=null,level=0,animation=0,disposed=false,renderedEvidence=null;
 const groups=box.querySelector("select");
 const format=n=>Number.isFinite(n)?new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(n):'unavailable';
 function draw(){if(!evidence||disposed)return;
 const groupStatus=box.querySelector('[data-zoom-group]');
 groupStatus.textContent=`Allocated resident records: ${format(evidence.synthetic)} · total active agents: unavailable (no changed-state measurement window) · rendered representatives in this spotlight: ${ctx&&level>0?evidence.representatives.length:0} · selected representatives: ${evidence.representatives.length} · worker sample: ${evidence.sampleCount}. Home district total: ${format(evidence.district?.population)}. ${evidence.representatives.length?'Bounded synthetic sample; no statistical representativeness claimed.':'Drill-down unavailable: no mapped IDs in this snapshot.'}`;
 if(renderedEvidence!==evidence){renderedEvidence=evidence;const members=box.querySelector('[data-zoom-members]');members.replaceChildren();
 for(const row of evidence.representatives){const button=doc.createElement('button');button.textContent=String(row.id);button.onclick=()=>{if(!disposed)Promise.resolve(onInspect(row.id)).catch(error=>{if(!disposed)count.textContent=error.message;});};members.append(button);}}
const tier=Math.round(level),d=evidence.district,p=evidence.person;
 count.textContent=tier===0?`City · ${format(evidence.represented)} represented · ${format(evidence.synthetic)} simulated residents`:tier===1?`Home district ${d?.id??'unavailable'} · ${format(d?.representedPopulation)} represented · ${format(d?.population)} simulated residents`:`Resident ${p?.id??'unavailable'} · ${p?'1':'0'} simulated resident · weight ${format(p?.weight)} represented`;
 inspect.disabled=!p;box.querySelector('[data-zoom-source]').textContent=`Snapshot minute ${format(evidence.minute)} · model ${evidence.modelVersion??'unavailable'} · seed ${evidence.seed??'unavailable'} · run ${evidence.run??'unavailable'} · tick ${format(evidence.tick)}`;
 if(!ctx){canvas.hidden=true;return;}ctx.clearRect(0,0,560,260);const camera=zoomProjection(evidence,level),project=p=>({x:280+(p.x-camera.x)*500/camera.span,y:130+(p.z-camera.z)*220/camera.span});
 for(const district of evidence.districts){const q=project(district);ctx.globalAlpha=Math.max(.15,1-level/2);ctx.fillStyle=district.id===d?.id?'#8cebc3':'#4d9f9a';ctx.beginPath();ctx.arc(q.x,q.y,Math.min(55,10+Math.sqrt(Math.max(0,district.representedPopulation||0))*.15),0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='12px system-ui';ctx.fillText(`${district.id}: ${format(district.representedPopulation)}`,q.x-35,q.y+65);}
 for(const p of evidence.representatives){const q=project(p);ctx.globalAlpha=Math.min(1,level);ctx.fillStyle='#ffd285';ctx.beginPath();ctx.arc(q.x,q.y,7,0,Math.PI*2);ctx.fill();ctx.fillText(String(p.id),q.x+12,q.y);}ctx.globalAlpha=1;
 }
 function move(target){win.cancelAnimationFrame(animation);const start=level,at=win.performance.now(),duration=win.matchMedia('(prefers-reduced-motion: reduce)').matches?0:900;function tick(now){const t=duration?Math.min(1,(now-at)/duration):1;level=start+(target-start)*(t*t*(3-2*t));slider.value=String(level);draw();if(t<1)animation=win.requestAnimationFrame(tick);}animation=win.requestAnimationFrame(tick);}
 slider.oninput=()=>{win.cancelAnimationFrame(animation);level=Number(slider.value);draw();};
 for(const button of box.querySelectorAll('[data-zoom-tier]'))button.onclick=()=>move(Number(button.dataset.zoomTier));
 inspect.onclick=()=>{if(evidence?.person)Promise.resolve(onInspect(evidence.person.id)).catch(error=>{count.textContent=error.message;});};
 function freeze(){frozen=structuredClone(latest);evidence=zoomEvidence(frozen);groups.replaceChildren();for(const district of evidence.districts){const option=doc.createElement('option');option.value=district.id;option.textContent=district.id;groups.append(option);}groups.value=evidence.district?.id??'';groups.disabled=!evidence.districts.length;level=0;slider.value='0';draw();}
 groups.onchange=()=>{win.cancelAnimationFrame(animation);evidence=zoomEvidence(frozen,groups.value);level=0;slider.value='0';draw();};
 box.ontoggle=()=>{if(box.open)freeze();else win.cancelAnimationFrame(animation);};
 return {update(frame){latest=frame;if(!box.open){evidence=zoomEvidence(frame);draw();}},destroy(){disposed=true;win.cancelAnimationFrame(animation);latest=frozen=evidence=renderedEvidence=null;box.remove();}};
}
