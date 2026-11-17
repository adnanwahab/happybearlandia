/** Read-only source projection. Radius is a presentation tolerance, not a service area. */
export function inspectInfrastructure(point, roads, source) {
  const unknown = 'Pipes, electricity, water and service connections: unknown — no spatial network evidence.';
  if (!point || ![point.x, point.z].every(Number.isFinite)) return {state:'missing',text:`No ground ray hit. ${unknown}`};
  if (source !== 'osm') return {state:'unsupported',text:`Unsupported source: no sourced infrastructure IDs. ${unknown}`};
  if (!Array.isArray(roads)) throw Error('Road records unavailable');
  let nearest=null, distance=8;
  for (const road of roads) for (let i=1;i<(road.pts?.length??0);i++) {
    const a=road.pts[i-1],b=road.pts[i];
    if (![...a,...b].every(Number.isFinite)) continue;
    const dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;
    const t=length?Math.max(0,Math.min(1,((point.x-a[0])*dx+(point.z-a[1])*dz)/length)):0;
    const d=Math.hypot(point.x-a[0]-t*dx,point.z-a[1]-t*dz);
    if(d<distance){distance=d;nearest=road;}
  }
  if (!nearest?.sourceRef?.match(/^osm:way:\d+$/)) return {state:'missing',text:`Road identity coverage unknown at ray. ${unknown}`};
  const refs=Array.isArray(nearest.nodeRefs)?nearest.nodeRefs.filter(id=>/^osm:node:\d+$/.test(id)):[];
  return {state:'supported',id:nearest.sourceRef,nodeRefs:refs,text:`Transport road · ${nearest.kind??'type unknown'} · ${nearest.sourceRef}. Recorded way node IDs: ${refs.length?refs.join(', '):'unknown'}. Node membership is not a verified routing or utility connection. ${unknown}`};
}

export function mountInfrastructureScanner({container,canvas,toGround,getData,now=()=>performance.now()}) {
  const doc=container.ownerDocument,win=doc.defaultView,root=doc.createElement('details');
  root.dataset.infrastructureScanner='';
  root.innerHTML='<summary>X-ray infrastructure scanner</summary><p>Hold the pointer over the street, or scan the center using keyboard or touch. Hatching means missing coverage, not absent utilities.</p><button type="button">Scan center</button><output role="status" aria-live="polite"></output>';
  const style=doc.createElement('style');style.textContent='[data-infrastructure-scanner]{max-width: min(360px,85vw)}[data-infrastructure-scanner] button{min-height:44px;min-width:44px}[data-infrastructure-scanner] :focus-visible{outline:3px solid #ffd86b;outline-offset:3px}[data-infrastructure-scanner] output{display:block;max-height:180px;overflow:auto;padding:12px;background:repeating-linear-gradient(135deg,#172132,#172132 7px,#304057 7px,#304057 9px);color:white;overflow-wrap:anywhere}';
  root.append(style);container.append(root);
  const lens=doc.createElement('div');lens.setAttribute('aria-hidden','true');
  lens.style.cssText='display:none;position:fixed;width:64px;height:64px;transform:translate(-50%,-50%);border:2px solid #ffd86b;border-radius:50%;pointer-events:none;z-index:20;background:repeating-linear-gradient(135deg,transparent,transparent 7px,#a9b9cc55 7px,#a9b9cc55 9px)';
  doc.body.append(lens);
  const toggle=()=>{if(!root.open)lens.style.display='none';};root.addEventListener('toggle',toggle);
  const output=root.querySelector('output'),button=root.querySelector('button');
  let disposed=false,lastScan=-Infinity,frames=0,maxFrameMs=0,scans=0,maxScanMs=0;
  output.textContent='Coverage unknown. Open scanner and scan a street.';
  function scan(event){if(disposed)return;const start=now();lens.style.display='block';lens.style.left=event.clientX+'px';lens.style.top=event.clientY+'px';try{const data=getData();const result=inspectInfrastructure(toGround(event),data.roads,data.source);output.textContent=result.text;root.dataset.state=result.state;}catch{root.dataset.state='failure';output.textContent='Scanner failed. Coverage unknown; retry Scan center.';}scans++;maxScanMs=Math.max(maxScanMs,now()-start);}
  const move=event=>{if(!root.open||event.buttons)return;const time=now();if(time-lastScan<100)return;lastScan=time;scan(event);};
  const center=()=>{const r=canvas.getBoundingClientRect();scan({clientX:r.left+r.width/2,clientY:r.top+r.height/2});};
  const key=event=>{if(event.key==='Escape'&&root.open){root.open=false;lens.style.display='none';root.querySelector('summary').focus();}};
  canvas.addEventListener('pointermove',move);button.addEventListener('click',center);root.addEventListener('keydown',key);
  const api={recordFrame(ms){if(!disposed&&root.open&&Number.isFinite(ms)){frames++;maxFrameMs=Math.max(maxFrameMs,ms);}},getState:()=>({disposed,frames,maxFrameMs,scans,maxScanMs,state:root.dataset.state??'missing'}),destroy(){if(disposed)return;disposed=true;canvas.removeEventListener('pointermove',move);button.removeEventListener('click',center);root.removeEventListener('keydown',key);root.removeEventListener('toggle',toggle);lens.remove();win.removeEventListener('pagehide',api.destroy);root.remove();}};
  win.addEventListener('pagehide',api.destroy,{once:true});return api;
}
