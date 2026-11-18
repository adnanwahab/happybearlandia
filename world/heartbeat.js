/** Recorded ActivityHistory v1 projection. No render samples or population estimates. */
export function heartbeatPoints(history) {
  if (history?.schemaVersion !== 'activity-history.v1' || !history.runId || history.coverage?.queryAvailable === false) return [];
  const width = history.bucketMinutes;
  if (!Number.isFinite(width) || width <= 0) return [];
  const rows = [...(history.buckets || [])].sort((a,b)=>a.startMinute-b.startMinute);
  const points = [];
  for (const row of rows) {
    if (!Number.isFinite(row.startMinute) || row.startMinute < 0 || row.endMinute !== row.startMinute + width) continue;
    const previous = points.at(-1);
    if (previous && row.startMinute < previous.endMinute) throw Error('Overlapping heartbeat buckets');
    if (previous && row.startMinute > previous.endMinute) points.push({minute:previous.endMinute,endMinute:row.startMinute,value:null});
    const valid = Number.isFinite(row.agentMinutes) && row.agentMinutes > 0 && Number.isSafeInteger(row.completedTrips) && row.completedTrips >= 0;
    points.push({minute:row.startMinute,endMinute:row.endMinute,value:valid?row.completedTrips:null,agentMinutes:valid?row.agentMinutes:null,runId:history.runId});
  }
  return points;
}

export async function seekHeartbeat(point, {getRunId, seek}) {
  if (point.value === null || point.runId !== getRunId()) throw Error('Recorded period is unavailable in the current run. Refresh history.');
  if (!seek) throw Error('World seeking unavailable for this authority.');
  const frame = await seek(point.minute);
  if (point.runId !== getRunId()) throw Error('Run changed during seek. Refresh history.');
  const minute = frame?.minute ?? frame?.clock?.minute;
  if (minute !== point.minute) throw Error('World did not reach the exact recorded period.');
  return minute;
}

export function mountHeartbeat(container, {source, seek}) {
  const doc=container.ownerDocument, root=doc.createElement('details');
  root.id='city-heartbeat';
  root.style.cssText='position:fixed;bottom:70px;left:12px;z-index:80;width:min(620px,calc(100vw - 24px));max-height:65vh;overflow:auto;background:#102730;color:#e3fff7;border:1px solid #58cbb4;border-radius:12px;padding:10px;box-sizing:border-box;font:13px system-ui';
  root.innerHTML='<style>#city-heartbeat circle{cursor:pointer}#city-heartbeat circle[data-selected]{animation:heartbeat-glow 1.8s ease-in-out infinite}@keyframes heartbeat-glow{50%{opacity:.4}}@media(prefers-reduced-motion:reduce){#city-heartbeat circle[data-selected]{animation:none}}</style><summary>City Heartbeat · recorded movement</summary><p>Computed synthetic model effects, not observed traffic. Completed trips per recorded bucket; denominator is raw recorded agent-minutes, not city population. Missing history creates gaps. Glow is decorative. Seeking recomputes the same run at the bucket start and pauses the world.</p><button type="button">Refresh recorded history</button><p role="status" aria-live="polite">Open to load this run.</p><svg viewBox="0 0 600 160" style="width:100%;display:block" role="img" aria-label="Recorded completed trips by simulation minute"></svg><div data-periods style="display:flex;gap:6px;flex-wrap:wrap"></div>';
  container.append(root);
  const status=root.querySelector('[role=status]'),svg=root.querySelector('svg'),periods=root.querySelector('[data-periods]'),refresh=root.querySelector('button');
  let serial=0,destroyed=false,busy=false;
  const node=(name,attrs)=>{const n=doc.createElementNS('http://www.w3.org/2000/svg',name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));svg.append(n);return n;};
  async function load(){
    if(destroyed||busy)return;
    const request=++serial,runId=source.getSnapshot().runId;
    svg.replaceChildren();periods.replaceChildren();status.textContent='Loading recorded history…';
    try {
      const history=await source.getHistory({groupBy:'hour',includeEvents:false,includeBuckets:true});
      if(destroyed||request!==serial)return;
      if(source.getSnapshot().runId!==runId||history.runId!==runId)throw Error('Run changed; refresh history.');
      periods.dataset.runId=runId;
      const points=heartbeatPoints(history),values=points.filter(p=>p.value!==null);
      status.textContent=values.length?`${runId} · ${history.bucketMinutes} simulation minutes per bucket. ${seek?'Choose a period to seek.':'Seeking unavailable in this authority.'}`:'Recorded history unavailable. No waveform inferred.';
      if(!values.length)return;
      const first=points[0].minute,span=Math.max(1,points.at(-1).endMinute-first),max=Math.max(1,...values.map(p=>p.value));
      let path='',previous=null;
      for(const p of points){
        if(p.value===null){previous=null;continue;}
        const x=20+(p.minute-first)/span*560,y=130-p.value/max*105;
        path+=`${previous?'L':'M'}${x},${y} `;previous=p;
        const dot=node('circle',{cx:x,cy:y,r:4,fill:'#77ffce'});const title=doc.createElementNS(svg.namespaceURI,'title');title.textContent=`Minute ${p.minute}: ${p.value} trips / ${p.agentMinutes} raw agent-minutes`;dot.append(title);
        const button=doc.createElement('button');button.type='button';button.textContent=`${p.minute}–${p.endMinute}: ${p.value} trips / ${p.agentMinutes} agent-min`;button.dataset.minute=String(p.minute);button.disabled=!seek;
        button.onclick=async()=>{
          if(busy||destroyed)return;for(const circle of svg.querySelectorAll('circle'))circle.removeAttribute('data-selected');dot.setAttribute('data-selected','');busy=true;refresh.disabled=true;for(const b of periods.children)b.disabled=true;
          status.textContent=`Seeking minute ${p.minute}…`;
          try{const minute=await seekHeartbeat(p,{getRunId:()=>source.getSnapshot().runId,seek});if(!destroyed)status.textContent=`World paused at exact simulation minute ${minute}. ${p.value} trips in [${p.minute}, ${p.endMinute}); ${p.agentMinutes} raw agent-minutes. Same-run recomputation, not an observed historical scene.`;}
          catch(error){if(!destroyed)status.textContent=error.message;}
          finally{busy=false;if(!destroyed){refresh.disabled=false;for(const b of periods.children)b.disabled=!seek;}}
        };dot.onclick=()=>button.click();periods.append(button);
      }
      node('path',{d:path,fill:'none',stroke:'#77ffce','stroke-width':2,'pointer-events':'none'});
      const axis=node('text',{x:20,y:155,fill:'#e3fff7','font-size':11});axis.textContent=`Simulation minute ${first} → ${points.at(-1).endMinute} · trips 0–${max}`;
    }catch(error){if(!destroyed&&request===serial)status.textContent=error.message;}
  }
  const toggle=()=>{if(root.open)void load();};root.addEventListener('toggle',toggle);refresh.addEventListener('click',load);
  const unsubscribe=source.subscribe(()=>{if(root.open&&!busy&&periods.firstChild&&source.getSnapshot().runId!==periods.dataset.runId){serial++;svg.replaceChildren();periods.replaceChildren();status.textContent='Run changed; refresh recorded history.';}});
  periods.dataset.runId=source.getSnapshot().runId;
  return {load,destroy(){if(destroyed)return;destroyed=true;serial++;unsubscribe?.();root.removeEventListener('toggle',toggle);refresh.removeEventListener('click',load);root.remove();}};
}
