/** Read-only by default. Explicit capability + supplied action required for control. */
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number.isFinite(value)?value:null;
const format=value=>number(value)===null?'unavailable':Number(value).toLocaleString(undefined,{maximumFractionDigits:1});
const describe=value=>{if(value==null)return '—';if(typeof value==='string')return value.slice(0,200);try{return JSON.stringify(value).slice(0,200);}catch{return 'Unserializable task metadata';}};
const hasOwnership=value=>{
 if(!value||typeof value!=='object')return false;
 const range=value.agentRange??value.range;
 if(Array.isArray(range)&&range.length===2&&range.every(Number.isFinite)&&range[1]>=range[0])return true;
 if(range&&Number.isFinite(range.start)&&Number.isFinite(range.end)&&range.end>=range.start)return true;
 if(value.bounds&&['minX','maxX','minZ','maxZ'].every(k=>Number.isFinite(value.bounds[k])))return true;
 return ['districtId','chunkId','tileKey'].some(k=>typeof value[k]==='string'&&value[k].length>0)||['districtIds','chunkIds','tileKeys'].some(k=>Array.isArray(value[k])&&value[k].some(id=>typeof id==='string'&&id.length>0));
};
function safeSnapshot(registry){
 const raw=registry?.getSnapshot?.()??registry?.snapshot?.();
 if(!raw||typeof raw.then==='function')throw new Error('Worker registry snapshot is unavailable.');
 return{workers:Array.isArray(raw)?raw:raw.workers||[],pools:raw.pools||[],errors:raw.errors||[]};
}
export function mountWorkerInspector({container,registry,capabilities={},actions={},getContext=()=>({})}={}){
 if(!container?.ownerDocument||!registry)throw new TypeError('Worker inspector requires a container and real registry.');
 const doc=container.ownerDocument,win=doc.defaultView,button=doc.createElement('button'),root=doc.createElement('aside'),sheet=doc.createElement('link');
 button.className='worker-inspector-button';button.dataset.testid='workers-button';button.textContent='Workers · 0';button.setAttribute('aria-expanded','false');
 root.className='worker-inspector';root.hidden=true;root.dataset.testid='worker-inspector';root.setAttribute('aria-label','Web worker inspector');
 root.innerHTML='<header><h2>Web workers</h2><button data-close aria-label="Close worker inspector">×</button></header><p data-summary></p><p data-availability></p><h3>Registered inventory</h3><div class="wi-table"><table><thead><tr><th>ID / type</th><th>Status / task</th><th>Average</th></tr></thead><tbody></tbody></table></div><div data-detail></div><h3>Queues and measured throughput</h3><div data-pools></div><h3>Last 60 seconds</h3><div data-timeline></div><h3>Failures / recovery</h3><div data-errors></div><p>Per-worker memory: unavailable. Portable browser APIs do not expose reliable per-worker heap usage.</p><button data-copy>Copy diagnostics</button><button data-download>Download worker report</button><div data-confirm hidden><p>Abrupt termination may cancel active work. Terminate selected worker?</p><button data-confirm-terminate>Confirm termination</button><button data-cancel-terminate>Cancel</button></div><p role="status"></p>';
 sheet.rel='stylesheet';sheet.href=new URL('./inspector.css',import.meta.url).href;container.append(sheet,button,root);
 let selected=null,confirmId=null,destroyed=false,snapshot={workers:[],pools:[],errors:[]},history=[],lastError=null,busy=false;
 const status=root.querySelector('[role=status]');
 const allowed=name=>capabilities[name]===true&&typeof actions[name]==='function';
 const actionButton=(name,id,label)=>allowed(name)?`<button data-action="${name}" data-id="${escape(id)}">${label}</button>`:'';
 function render(){
  const workers=snapshot.workers,counts={busy:0,idle:0,failed:0};for(const w of workers){if(['busy','running'].includes(w.status))counts.busy++;else if(['failed','error','crashed'].includes(w.status))counts.failed++;else if(['idle','ready'].includes(w.status))counts.idle++;}
  button.textContent=`Workers · ${workers.length}`;
  root.querySelector('[data-summary]').textContent=`${workers.length} registered · ${counts.busy} busy · ${counts.idle} idle · ${counts.failed} failed`;
  if(root.hidden)return;
  root.querySelector('[data-availability]').textContent=lastError?`Registry unavailable: ${lastError}`:'Live registry observations. Rates count completed tasks, not simulated agents or futures.';
  root.querySelector('tbody').innerHTML=workers.map(w=>`<tr><td><button data-worker="${escape(w.id)}">${escape(w.id)}</button><br>${escape(w.type||'unspecified')}</td><td>${escape(w.status)}<br>${escape(describe(w.currentTask))}</td><td>${format(w.avgTaskMs)} ms</td></tr>`).join('')||'<tr><td colspan="3">No workers are registered. No worker counts are inferred.</td></tr>';
  const worker=workers.find(w=>String(w.id)===selected),detail=root.querySelector('[data-detail]');
  if(worker){const ownership=worker.ownership??worker.currentTask?.ownership;detail.innerHTML=`<h3>${escape(worker.id)}</h3><dl><dt>Type</dt><dd>${escape(worker.type)}</dd><dt>Status</dt><dd>${escape(worker.status)}</dd><dt>Started</dt><dd>${worker.createdAt?escape(new Date(worker.createdAt).toISOString()):'unavailable'}</dd><dt>Current task</dt><dd>${escape(describe(worker.currentTask))}</dd><dt>Task progress</dt><dd>${number(worker.progress)===null?'unavailable':escape(worker.progress)}</dd><dt>Completed / failed</dt><dd>${format(worker.tasksCompleted)} / ${format(worker.tasksFailed)}</dd><dt>Average task</dt><dd>${format(worker.avgTaskMs)} ms</dd><dt>Queue depth</dt><dd>${format(worker.queueDepth)}</dd><dt>Heartbeat support</dt><dd>${escape(worker.heartbeatStatus||'not reported')}</dd><dt>Last heartbeat</dt><dd>${number(worker.lastHeartbeat)===null?'unavailable':`${format(Math.max(0,Date.now()-worker.lastHeartbeat))} ms ago`}</dd><dt>Ownership</dt><dd>${escape(describe(ownership))}</dd></dl>${hasOwnership(ownership)?'<button data-show-work>Show work in world</button>':'<p>No spatial or agent-range ownership reported.</p>'}${actionButton('drainWorker',worker.id,'Drain worker')}${actionButton('restartWorker',worker.id,'Restart worker')}${actionButton('terminateWorker',worker.id,'Terminate worker')}`;}
  else detail.innerHTML='<p>Select a registered worker for details.</p>';
  const poolNode=root.querySelector('[data-pools]');
  if(!poolNode.contains(doc.activeElement))poolNode.innerHTML=snapshot.pools.map(p=>{const id=p.id??p.name??p.type;return `<section><b>${escape(id)}</b> · ${escape(p.status||'')} · queue ${format(p.queueDepth??p.queued)}${actionButton('pausePool',id,'Pause pool')}${actionButton('drainPool',id,'Drain pool')}${actionButton('resumePool',id,'Resume pool')}${Array.isArray(p.queue)?`<ul>${p.queue.slice(0,8).map(task=>`<li>${escape(task.id)} · ${escape(task.kind)} · priority ${format(task.priority)} · waiting ${format(task.waitMs)} ms</li>`).join('')}</ul>`:''}${allowed('setPoolSize')?`<label>Worker count <input data-pool-size="${escape(id)}" type="number" min="1" max="12" step="1" value="${Number.isInteger(p.size)?p.size:0}"></label><button data-resize="${escape(id)}">Set count</button>`:''}</section>`;}).join('')||'<p>No pool metadata reported.</p>';
  const first=history[0],last=history.at(-1),seconds=first&&last?(last.at-first.at)/1000:0,delta=first&&last?last.completed-first.completed:0;
  const throughput=doc.createElement('p');throughput.textContent=seconds>0&&delta>=0?`${format(delta/seconds)} completed tasks/s over ${format(seconds)} observed seconds`:'Throughput unavailable until two observations; counter resets are not negative throughput.';poolNode.append(throughput);while(poolNode.querySelectorAll(':scope > p').length>1)poolNode.querySelector(':scope > p')?.remove();
  root.querySelector('[data-timeline]').innerHTML=workers.map(w=>{const samples=history.filter(h=>h.statuses[w.id]);return `<p>${escape(w.id)} <span class="wi-timeline" aria-label="Timestamped observations over the last 60 seconds">${samples.map(h=>`<i class="wi-${escape(h.statuses[w.id])}" style="left:${Math.max(0,Math.min(100,(h.at-(Date.now()-60000))/600))}%" title="${escape(h.statuses[w.id])} · ${escape(new Date(h.at).toISOString())}"></i>`).join('')}</span></p>`;}).join('')||'<p>No observations yet.</p>';
  const errors=[...snapshot.errors,...workers.filter(w=>w.lastError).map(w=>({workerId:w.id,error:w.lastError,recovered:w.restarts>0}))];
  root.querySelector('[data-errors]').innerHTML=errors.slice(-100).map(e=>`<p><b>${escape(e.workerId??e.id??'Worker')}</b> ${escape(describe(e.error??e.message??e))} · recovery ${e.recovered===true?'reported recovered':e.recovered===false?'not recovered':'not reported'}</p>`).join('')||'<p>No failures reported by registry.</p>';
 }
 function update(){if(destroyed)return;try{snapshot=safeSnapshot(registry);lastError=null;const at=Date.now(),completed=snapshot.workers.reduce((sum,w)=>sum+(number(w.tasksCompleted)||0),0);const observation={at,completed,statuses:Object.fromEntries(snapshot.workers.map(w=>[w.id,w.status]))};if(history.at(-1)&&Math.floor(history.at(-1).at/250)===Math.floor(at/250))history[history.length-1]=observation;else history.push(observation);history=history.filter(h=>h.at>=at-60000).slice(-240);}catch(error){lastError=error.message;}render();}
 function report(){const context=getContext()||{};return{version:'hbl.worker-diagnostics.v1',capturedAt:new Date().toISOString(),scope:'local browser registry',browser:win.navigator.userAgent,memory:'unavailable',context:Object.fromEntries(['quality','renderer','experimentId','modelVersion','seed','population'].filter(k=>context[k]!=null).map(k=>[k,context[k]])),inventory:snapshot,observations:history};}
 async function act(name,id,...args){if(!allowed(name)||busy)throw new Error('Action is unavailable in this capability context.');busy=true;try{await actions[name](id,...args);status.textContent=`${name} requested for ${id}.`;update();}finally{busy=false;}}
 async function click(event){try{
  const target=event.target;
  if(target===button||target.closest('[data-close]')){root.hidden=!root.hidden;button.setAttribute('aria-expanded',String(!root.hidden));update();}
  const row=target.closest('[data-worker]');if(row){selected=row.dataset.worker;render();}
  if(target.closest('[data-show-work]')){const w=snapshot.workers.find(w=>String(w.id)===selected),ownership=w?.ownership??w?.currentTask?.ownership;if(hasOwnership(ownership))root.dispatchEvent(new win.CustomEvent('world:worker-show-work',{bubbles:true,detail:{workerId:w.id,type:w.type,ownership}}));}
  const action=target.closest('[data-action]');if(action){if(action.dataset.action==='terminateWorker'){confirmId=action.dataset.id;root.querySelector('[data-confirm]').hidden=false;}else await act(action.dataset.action,action.dataset.id);}
  if(target.closest('[data-cancel-terminate]')){confirmId=null;root.querySelector('[data-confirm]').hidden=true;}
  if(target.closest('[data-confirm-terminate]')&&confirmId){const id=confirmId;confirmId=null;root.querySelector('[data-confirm]').hidden=true;await act('terminateWorker',id);}
  const resize=target.closest('[data-resize]');if(resize){const id=resize.dataset.resize,input=[...root.querySelectorAll('[data-pool-size]')].find(n=>n.dataset.poolSize===id),count=Number(input?.value);if(!Number.isInteger(count)||count<1||count>12)throw new Error('Worker count must be an integer from 1 to 12.');await act('setPoolSize',id,count);}
  if(target.closest('[data-copy]')){if(!win.navigator.clipboard?.writeText)throw new Error('Clipboard unavailable; download the report instead.');await win.navigator.clipboard.writeText(JSON.stringify(report(),null,2));status.textContent='Worker diagnostics copied.';}
  if(target.closest('[data-download]')){const url=URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:'application/json'})),a=doc.createElement('a');a.href=url;a.download='hbl-worker-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Worker diagnostics downloaded.';}
 }catch(error){status.textContent=error.message;}}
 button.addEventListener('click',click);root.addEventListener('click',click);let pendingFrame=null;const unsubscribe=registry.subscribe?.(()=>{if(pendingFrame===null)pendingFrame=win.requestAnimationFrame(()=>{pendingFrame=null;update();});});const timer=win.setInterval(()=>{if(!doc.hidden)update();},1000);update();
 return{update,destroy(){if(destroyed)return;destroyed=true;win.clearInterval(timer);if(pendingFrame!==null)win.cancelAnimationFrame(pendingFrame);if(typeof unsubscribe==='function')unsubscribe();button.removeEventListener('click',click);root.removeEventListener('click',click);root.remove();button.remove();sheet.remove();}};
}

/** Host opts into analyst mode explicitly. Registry still enforces pool capabilities.
 * Single-worker restart/drain/termination require separate owner-supplied callbacks;
 * the registry does not currently expose those controls, so none are invented. */
export function createWorkerInspectorControls(registry,{analyst=false}={}){
 if(!analyst||typeof registry?.performAction!=='function')return{capabilities:{},actions:{}};
 const names={pausePool:'pause',resumePool:'resume',drainPool:'drain',setPoolSize:'resize'},capabilities={},actions={};
 for(const [name,action]of Object.entries(names)){
  capabilities[name]=true;
  actions[name]=(id,value)=>registry.performAction(id,action,value,{developer:true});
 }
 return{capabilities,actions};
}
