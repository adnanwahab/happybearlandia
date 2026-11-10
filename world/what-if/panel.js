import {PROJECTS,COMPARISON_CONFIG,validateProject} from './catalog.js';
import {createTrackedWorker} from '../workers/worker-registry.js';

const fmt=(value,percent=false)=>value===null?'No observed trips':percent?`${(value*100).toFixed(1)}%`:`${value.toFixed(1)} min`;
const delta=(value,percent=false)=>value===null?'Unavailable':`${value>0?'+':''}${(value*(percent?100:1)).toFixed(1)} ${percent?'pp':'min'}`;
export function mountNeighborhoodWhatIf({container=document.body,scene,camera,controls,renderer,THREE,getContext}) {
  const doc=container.ownerDocument,button=doc.createElement('button'),root=doc.createElement('section');
  button.type='button';button.textContent='What if?';button.dataset.testid='what-if-open';button.setAttribute('aria-expanded','false');
  (doc.getElementById('living-city-toolbar')||container).append(button);
  root.className='wi-panel';root.hidden=true;root.dataset.testid='what-if-panel';root.setAttribute('aria-label','Neighborhood what if');root.setAttribute('role','region');
  root.innerHTML=`<header><div><small>NEIGHBORHOOD LAB</small><h2>What if we added…</h2></div><button type="button" data-close aria-label="Close neighborhood comparison">×</button></header>
  <p>Place one addition, simulate a day, and see who benefits.</p>
  <label>Addition <select data-kind aria-label="Neighborhood addition">${Object.entries(PROJECTS).map(([id,p])=>`<option value="${id}">${p.label}</option>`).join('')}</select></label>
  <p data-assumption class="wi-note"></p><div class="wi-actions"><button type="button" data-place>Choose on map</button><button type="button" data-center>Use view center</button></div>
  <p data-location>No location selected.</p><p class="wi-note">Concept marker only; this does not check parcel ownership or building clearance.</p>
  <div class="wi-actions"><button type="button" data-run disabled>Simulate before & after</button><button type="button" data-cancel hidden>Cancel</button><button type="button" data-clear>Clear</button></div>
  <p data-status role="status" aria-live="polite">Choose an addition and a location.</p><progress data-progress max="1" value="0" hidden aria-label="Neighborhood simulation progress"></progress>
  <div data-results hidden><h3>Same people. Two possible days.</h3><p data-summary class="wi-note"></p><div class="wi-table"><table><caption>Unchanged neighborhood → with your addition</caption><thead><tr><th>Measure</th><th>Before</th><th>After</th><th>Change</th></tr></thead><tbody data-metrics></tbody></table></div>
  <p class="wi-note">Select a measure to highlight affected comparison residents at their original homes. Green = improved; orange = worsened. These markers belong to this separate synthetic comparison.</p><p data-explanation></p><ul data-residents class="wi-residents"></ul></div>
  <details><summary>How this comparison works</summary><p>Two fresh populations of 200 synthetic people, seed 42, start at midnight with identical homes, jobs and resources. The existing population model advances both for 24 hours in 15-minute steps. This is a separate experiment; the live population continues independently.</p><p>Commute is mean planned duration of work departures observed at 15-minute steps. Housing burden is average annual rent ÷ household income across households. Daily access is the average share of two destinations—grocery and park—within a 400 m straight-line walk of each home (10 minutes at 2.4 km/h).</p><p>District capacities and behavior are synthetic assumptions. No construction period, public budget, land acquisition, street routing or empirical calibration is modeled. Small or zero changes are valid results.</p></details>`;
  const style=doc.createElement('link');style.rel='stylesheet';style.href=new URL('./panel.css',import.meta.url).href;container.append(style,root);
  const $=selector=>root.querySelector(selector),canvas=renderer.domElement,group=new THREE.Group();group.name='Neighborhood what-if preview';scene.add(group);
  let project=null,result=null,worker=null,armed=false,destroyed=false,down=null,metric='access';
  const markers=new THREE.Group();group.add(markers);
  const proposal=new THREE.Group();group.add(proposal);
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const status=text=>{$('[data-status]').textContent=text;};
  function disposeChildren(parent){for(const child of [...parent.children]){parent.remove(child);child.traverse(node=>{node.geometry?.dispose();if(Array.isArray(node.material))node.material.forEach(m=>m.dispose());else node.material?.dispose();});}}
  function setArmed(value){armed=value;$('[data-place]').textContent=value?'Cancel map placement':'Choose on map';$('[data-place]').setAttribute('aria-pressed',String(value));canvas.style.cursor=value?'crosshair':'';}
  function busy(value){$('[data-kind]').disabled=value;for(const sel of ['[data-place]','[data-center]','[data-clear]'])$(sel).disabled=value;$('[data-run]').disabled=value||!project;$('[data-cancel]').hidden=!value;$('[data-progress]').hidden=!value;}
  function cancel(){if(!worker)return;worker.terminate();worker=null;busy(false);status('Comparison cancelled. Your proposed location is retained.');}
  function invalidate(){result=null;$('[data-results]').hidden=true;disposeChildren(markers);}
  function paintProposal(){disposeChildren(proposal);if(!project)return;
    const color=PROJECTS[project.kind].color;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(18,1.8,8,32),new THREE.MeshBasicMaterial({color,depthTest:false}));ring.rotation.x=-Math.PI/2;ring.position.set(project.x,2,project.z);ring.renderOrder=30;proposal.add(ring);
    const height=project.kind==='housing'?28:project.kind==='transit'?10:6;
    const shape=new THREE.Mesh(project.kind==='park'?new THREE.ConeGeometry(8,18,8):new THREE.BoxGeometry(12,height,12),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,depthTest:false}));shape.position.set(project.x,height/2+3,project.z);shape.renderOrder=29;proposal.add(shape);
  }
  function place(x,z){try{project=validateProject({kind:$('[data-kind]').value,x,z},getContext());invalidate();paintProposal();setArmed(false);$('[data-location]').textContent=`Proposed ${PROJECTS[project.kind].label.toLowerCase()} · E ${x.toFixed(0)} m, S ${z.toFixed(0)} m`;$('[data-run]').disabled=false;status('Location ready. Simulate to compare the two days.');}catch(error){status(error.message);}}
  function reset(){cancel();setArmed(false);project=null;invalidate();paintProposal();$('[data-run]').disabled=true;$('[data-location]').textContent='No location selected.';status('Choose an addition and a location.');}
  function focus(home){const target=new THREE.Vector3(home.x,controls.target.y,home.z),offset=target.clone().sub(controls.target);camera.position.add(offset);controls.target.copy(target);controls.update();}
  function showMetric(id){if(!result)return;metric=id;disposeChildren(markers);const list=$('[data-residents]');list.replaceChildren();
    const threshold=id==='commute'?.1:.0001;
    const affected=result.residents.filter(r=>r.delta[id]!==null&&Math.abs(r.delta[id])>threshold).sort((a,b)=>Math.abs(b.delta[id])-Math.abs(a.delta[id]));
    const improved=r=>id==='access'?r.delta[id]>0:r.delta[id]<0;
    const good=affected.filter(improved).length;
    $('[data-explanation]').textContent=`${good} improved · ${affected.length-good} worsened · ${result.population-affected.length} unchanged or unavailable. ${id==='access'?'New destinations and moves change walking access.':id==='burden'?'District rents, income and household moves change housing burden.':'Transit access, mode choice, congestion and moves can change work-trip duration.'}`;
    for(const r of affected){const marker=new THREE.Mesh(new THREE.ConeGeometry(3,12,5),new THREE.MeshBasicMaterial({color:improved(r)?0x56d899:0xffa961,depthTest:false}));marker.position.set(r.home.x,22,r.home.z);marker.renderOrder=31;markers.add(marker);}
    for(const r of affected.slice(0,12)){const li=doc.createElement('li'),b=doc.createElement('button');b.type='button';b.textContent=`Resident ${Number(r.id.split('-p').pop())+1}: ${delta(r.delta[id],id!=='commute')} · ${r.before.district}`;b.addEventListener('click',()=>{focus(r.home);status(`Comparison resident ${r.id}: ${fmt(r.before[id],id!=='commute')} → ${fmt(r.after[id],id!=='commute')}. Marker shows the original home.`);});li.append(b);list.append(li);}
    if(!affected.length){const li=doc.createElement('li');li.textContent='No measurable change for this measure. Try another location or addition.';list.append(li);}
    root.querySelectorAll('[data-metric]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.metric===id)));
  }
  function renderResult(value){result=value;$('[data-results]').hidden=false;$('[data-summary]').textContent=`${value.population} synthetic residents · seed ${value.seed} · 24 hours · ${value.before.commuteTrips} / ${value.after.commuteTrips} work departures. Positive change means more; negative means less.`;
    const body=$('[data-metrics]');body.replaceChildren();for(const [id,label]of [['commute','Average commute'],['burden','Housing burden'],['access','Daily access']]){const tr=doc.createElement('tr'),th=doc.createElement('th'),b=doc.createElement('button');b.type='button';b.textContent=label;b.dataset.metric=id;b.addEventListener('click',()=>showMetric(id));th.scope='row';th.append(b);tr.append(th);for(const text of [fmt(value.before[id],id!=='commute'),fmt(value.after[id],id!=='commute'),delta(value.before[id]===null||value.after[id]===null?null:value.after[id]-value.before[id],id!=='commute')]){const td=doc.createElement('td');td.textContent=text;tr.append(td);}body.append(tr);}showMetric(metric);status('Comparison complete. Select a measure to explore who changed.');}
  function run(){if(worker||!project)return;setArmed(false);invalidate();busy(true);$('[data-progress]').value=0;status('Simulating two possible days…');
    try{const active=createTrackedWorker(new URL('./compare.worker.js',import.meta.url),{type:'module'},{type:'Neighborhood what-if',group:'experiments'});worker=active;
      active.onmessage=event=>{if(destroyed||worker!==active)return;const message=event.data;if(message.type==='progress'){$('[data-progress]').value=message.progress;status(`Simulating two possible days… ${Math.round(message.progress*100)}%`);return;}active.terminate();worker=null;busy(false);if(message.type==='result')renderResult(message.result);else status(`Comparison failed: ${message.error||'Unknown error'}`);};
      active.onerror=event=>{if(worker!==active)return;active.terminate();worker=null;busy(false);status(`Comparison failed: ${event.message||'Worker unavailable'}`);};
      active.postMessage({context:structuredClone(getContext()),project:{...project},config:COMPARISON_CONFIG});
    }catch(error){worker?.terminate();worker=null;busy(false);status(`Comparison failed: ${error.message}`);}
  }
  function open(){root.hidden=false;group.visible=true;button.setAttribute('aria-expanded','true');$('[data-kind]').focus();}
  function close(){setArmed(false);root.hidden=true;group.visible=false;button.setAttribute('aria-expanded','false');button.focus();}
  const listeners=[];function listen(node,type,fn,options){node.addEventListener(type,fn,options);listeners.push(()=>node.removeEventListener(type,fn,options));}
  listen(button,'click',()=>root.hidden?open():close());listen($('[data-close]'),'click',close);
  listen($('[data-kind]'),'change',()=>{invalidate();$('[data-assumption]').textContent=PROJECTS[$('[data-kind]').value].assumption;if(project)place(project.x,project.z);});
  listen($('[data-place]'),'click',()=>{setArmed(!armed);status(armed?'Click the ground inside the loaded neighborhood. Drag to adjust your view; Escape cancels placement.':'Placement cancelled.');});
  listen($('[data-center]'),'click',()=>place(controls.target.x,controls.target.z));listen($('[data-clear]'),'click',reset);listen($('[data-run]'),'click',run);listen($('[data-cancel]'),'click',cancel);
  listen(canvas,'pointerdown',event=>{if(armed)down=[event.clientX,event.clientY];},{capture:true});
  listen(canvas,'pointerup',event=>{if(!armed||!down)return;const moved=Math.hypot(event.clientX-down[0],event.clientY-down[1]);down=null;if(moved>5)return;event.preventDefault();const bounds=canvas.getBoundingClientRect();pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);ray.setFromCamera(pointer,camera);const point=ray.ray.intersectPlane(plane,new THREE.Vector3());if(point)place(point.x,point.z);else status('Choose visible ground or use view center.');},{capture:true});
  listen(doc,'keydown',event=>{if(event.key==='Escape'&&!root.hidden){if(armed){setArmed(false);status('Placement cancelled.');}else close();}});
  $('[data-assumption]').textContent=PROJECTS.park.assumption;group.visible=false;
  return {destroy(){destroyed=true;cancel();listeners.forEach(remove=>remove());disposeChildren(group);scene.remove(group);root.remove();button.remove();style.remove();}};
}
