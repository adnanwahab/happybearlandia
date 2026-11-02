/** Collection follows worker updates, never animation frames. */
export function mountEconomyPanel(root){
 const doc=root.ownerDocument,box=doc.createElement('section');
 box.innerHTML='<h3>Economic records</h3><p>Synthetic model outputs from the same people and clock. Collects daily snapshots, bounded person samples, businesses and retained events.</p><label><input type="checkbox"> Collect records</label> <button type="button">Save current snapshot</button> <a href="/world/economy-records" target="_blank" rel="noopener">View collected records ↗</a><p role="status"></p>';
 root.append(box);const toggle=box.querySelector('input'),button=box.querySelector('button'),status=box.querySelector('[role=status]');let latest,busy=false,lastKey='',dead=false;
 async function save(){if(!latest||busy)return;busy=true;button.disabled=true;const frame=latest,key=`${frame.runtime.id}:${frame.runtime.revision}:${Math.floor(frame.minute/1440)}`;
 try{const response=await fetch('/api/economy-records',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({runId:`${frame.runtime.id}_${frame.runtime.revision}`,tick:frame.tick,minute:frame.minute,modelVersion:frame.modelVersion,config:frame.config,metrics:frame.metrics,economy:frame.economy,people:frame.visibleAgents,households:frame.households,businesses:frame.businesses,districts:frame.districts,events:frame.events})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Save failed');lastKey=key;if(!dead)status.textContent=`Saved tick ${frame.tick} · ${result.id}`;}catch(error){if(!dead)status.textContent=`Collection failed: ${error.message}`;toggle.checked=false;}finally{busy=false;button.disabled=false;}}
 button.onclick=save;toggle.onchange=()=>{if(toggle.checked)save()};
 return{update(frame){latest=frame;if(toggle.checked&&`${frame.runtime.id}:${frame.runtime.revision}:${Math.floor(frame.minute/1440)}`!==lastKey)void save()},destroy(){dead=true;box.remove()}};
}
