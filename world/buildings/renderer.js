// Physical view only. Stored monthly states drive construction; this module never
// computes completion, occupancy, cost, or edits approved scenario input.
// mountBuildingWorld and attachBuildingWorld return synchronously; .ready is an
// optional Promise for callers/tests. update/beginPlacement may be called early.
import { validateBuildingPlacement,createBuildingProposal } from './proposal.js';
export function buildingStateAtMonth(run, project, month=0) {
  if(project.status==='proposed'||project.status==='cancelled')return {month:0,status:project.status,progress:0,floorsBuilt:0,completedUnits:0,occupiedUnits:0,publicCost:0};
  const record=(run?.projects||[]).find(p=>p.projectId===project.id);
  const states=Array.isArray(record?.states)?record.states:[];
  let state=null;for(const row of states)if(row.month<=month&&(!state||row.month>state.month))state=row;
  return state ? {...state} : {month:0,status:project.status==='cancelled'?'cancelled':'proposed',progress:0,floorsBuilt:0,completedUnits:0,occupiedUnits:0,publicCost:0};
}
export function buildingDimensions(project) {
  const side=Math.sqrt(Math.max(0,Number(project.geometry?.footprintSqFt)||0)*0.09290304);
  return {width:side,depth:side,height:Math.max(1,Number(project.geometry?.heightMeters)||3),floors:Math.max(1,Number(project.geometry?.floors)||1)};
}
export function storedMetricSnapshot(run,month=0) {
  const rows=run?.monthlyTimeline||run?.timeline||[];let chosen=null;
  for(const row of rows){const t=Number.isFinite(row.month)?row.month:Number.isFinite(row.year)?row.year*12:null;if(t!==null&&t<=month&&(!chosen||t>chosen.month))chosen={...row,month:t};}
  return chosen;
}
export function illustrativeWorldMapping(run,month=0) {
  const row=storedMetricSnapshot(run,month),initial=storedMetricSnapshot(run,0);
  const supply=row?.metrics?.housing_supply,start=initial?.metrics?.housing_supply,vacancy=row?.metrics?.vacancy_rate;
  return {supply,initialSupply:start,supplyIndex:Number.isFinite(supply)&&start>0?supply/start:1,vacancyPercent:Number.isFinite(vacancy)?vacancy:null,recordedMonth:row?.month??null};
}
// Suggest a geometrically free starting parcel; the user still places/reviews it.
export function findBuildableLocation(proposal,context={}) {
  const original=proposal.location||{};
  for(let ring=0;ring<18;ring++)for(let step=0;step<(ring?12:1);step++){
    const angle=step*Math.PI/6,x=Math.round(Math.sin(angle)*ring*65),z=Math.round(140+Math.cos(angle)*ring*65);
    const candidate={...proposal,location:{...original,x,z}};
    if(validateBuildingPlacement(candidate,context).valid)return candidate.location;
  }
  return null;
}
// Detached visual preview only; approval and simulation remain host-owned.
export function previewBuildingWorld(scenario={}, proposal) {
  const projects=structuredClone(scenario.projects||[]),worldVisuals=structuredClone(scenario.worldVisuals||{});
  const merge=(base,patch)=>{const result={...base,...patch};for(const key of ['location','program','geometry','finance','construction'])if(patch[key])result[key]={...base?.[key],...patch[key]};return result};
  const put=project=>{const index=projects.findIndex(p=>p.id===project.id);if(index<0)projects.push(project);else projects[index]=project};
  if(proposal?.schemaVersion==='building-proposal.v1')put({...structuredClone(proposal),status:'proposed'});
  for(const op of proposal?.operations||[]){
    if(op.op==='add_building')put({...structuredClone(op.value),status:'proposed'});
    if(op.op==='change_world_visual')worldVisuals[op.target.split('.').at(-1)]=structuredClone(op.value);
    const existing=projects.find(p=>p.id===op.target);
    if(existing&&op.op==='update_building')put({...merge(existing,structuredClone(op.value)),status:'proposed'});
    if(existing&&op.op==='move_building')put({...existing,location:{...existing.location,...structuredClone(op.value)},status:'proposed'});
    if(existing&&op.op==='remove_building')put({...existing,status:'cancelled'});
  }
  return {projects,worldVisuals};
}
const clone=value=>structuredClone(value);
const typing=target=>target?.closest?.('input,textarea,select,[contenteditable="true"]');
const cssURL=new URL('./buildings.css',import.meta.url).href;
function style(container){const link=container.ownerDocument.createElement('link');link.rel='stylesheet';link.href=cssURL;container.append(link);return link}

export function mountBuildingWorld(container, options={}) {
  const doc=container.ownerDocument,root=doc.createElement('section');root.className='building-world';root.dataset.testid='building-world';
  root.innerHTML='<div class="bw-toolbar"><strong>Construction world</strong><span data-bw-month>Month 0</span><span class="bw-hint">Drag to orbit · scroll to zoom</span></div><div class="bw-canvas" tabindex="0" aria-label="3D building placement and construction world"></div><div class="bw-toolbar bw-transport"><button type="button" data-bw-play>Play months</button><label>Construction month <output data-bw-output>0</output></label><input type="range" data-bw-scrub min="0" max="120" step="1" value="0" aria-label="Building construction month"></div><p class="bw-model-metrics" data-bw-metrics></p><p class="bw-status" role="status" aria-live="polite">Preparing 3D world…</p><div class="bw-selection" hidden></div>';
  container.append(root);if(options.controls===false)root.querySelector('.bw-transport').hidden=true;const sheet=style(root),view=root.querySelector('.bw-canvas'),status=root.querySelector('.bw-status');
  let current={projects:[],month:0,...options},attachment=null,renderer=null,scene=null,camera=null,frame=null,resize=null,destroyed=false,queuedPlacement=null,orbitCleanup=null,playTimer=null,placementContext=null;
  const sync=()=>{attachment?.update(current);const mapping=illustrativeWorldMapping(current.run,current.month);root.querySelector('[data-bw-metrics]').textContent=mapping.recordedMonth===null?'Context town is illustrative; no run metrics selected.':`Recorded month ${mapping.recordedMonth}: housing supply ${mapping.supply==null?'unavailable':new Intl.NumberFormat().format(mapping.supply)} · vacancy ${mapping.vacancyPercent===null?'unavailable':mapping.vacancyPercent.toFixed(2)+'%'}. Context height reflects the supply index and shade reflects vacancy; these are illustrative symbols, not added parcels.`;scene?.traverse(object=>{const context=object.userData?.contextBuilding;if(context&&object.isMesh){const scale=(current.worldVisuals?.heightScale||1)*Math.max(.5,Math.min(1.8,mapping.supplyIndex));object.scale.y=scale;object.position.y=context.heightMeters*scale/2;object.material.color.set(current.worldVisuals?.facadeColor||object.userData.contextBaseColor).lerp(object.material.color.clone().set('#33464b'),Math.max(0,Math.min(.6,(mapping.vacancyPercent||0)/100)))}if(object.isHemisphereLight)object.intensity=1+(current.worldVisuals?.nightBrightness??1)});root.querySelector('[data-bw-month]').textContent=`Month ${current.month||0}`;root.querySelector('[data-bw-output]').textContent=String(current.month||0);root.querySelector('[data-bw-scrub]').value=String(current.month||0);const end=Math.max(0,...(current.run?.projects||[]).flatMap(p=>(p.states||[]).map(s=>s.month)));root.querySelector('[data-bw-scrub]').max=String(end||120)};
  const stopPlay=()=>{clearInterval(playTimer);playTimer=null;root.querySelector('[data-bw-play]').textContent='Play months'};
  const scrub=()=>{stopPlay();current.month=Number(root.querySelector('[data-bw-scrub]').value);sync();options.onMonthChange?.(current.month)};
  const playMonths=()=>{if(playTimer)return stopPlay();if(!current.run){status.textContent='Select a completed future to replay recorded construction.';return}const max=Number(root.querySelector('[data-bw-scrub]').max);if(current.month>=max)current.month=0;root.querySelector('[data-bw-play]').textContent='Pause months';playTimer=setInterval(()=>{current.month=(current.month||0)+1;sync();options.onMonthChange?.(current.month);if(current.month>=max)stopPlay()},180)};
  root.querySelector('[data-bw-scrub]').addEventListener('input',scrub);root.querySelector('[data-bw-play]').addEventListener('click',playMonths);
  const api={update(value){current={...current,...value};sync()},beginPlacement(proposal){queuedPlacement=clone(proposal);attachment?.beginPlacement(proposal)},cancelPlacement(){queuedPlacement=null;attachment?.cancelPlacement()},get placementContext(){return placementContext?clone(placementContext):null},get suggestedLocation(){return placementContext?findBuildableLocation(createBuildingProposal(),placementContext):null},destroy(){destroyed=true;stopPlay();root.querySelector('[data-bw-scrub]').removeEventListener('input',scrub);root.querySelector('[data-bw-play]').removeEventListener('click',playMonths);attachment?.destroy();if(frame!==null)cancelAnimationFrame(frame);resize?.disconnect();orbitCleanup?.();if(scene)disposeTree(scene);renderer?.dispose();renderer?.forceContextLoss?.();sheet.remove();root.remove()},ready:null};
  api.ready=(async()=>{try{
    const THREE=await import('/vendor/three/three.module.js');if(destroyed)return;
    scene=new THREE.Scene();scene.background=new THREE.Color('#dcebef');camera=new THREE.PerspectiveCamera(45,1,.5,8000);
    renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,2));view.append(renderer.domElement);
    const light=new THREE.HemisphereLight(0xffffff,0x667868,2);scene.add(light);const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(100,300,100);scene.add(sun);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),new THREE.MeshStandardMaterial({color:'#c5d0bb',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.3;scene.add(ground);
    const grid=new THREE.GridHelper(1200,30,0x819f94,0xa5b6a1);grid.position.y=.05;scene.add(grid);
    const town={buildings:[],districts:[],bounds:{minX:-600,maxX:600,minZ:-600,maxZ:600}};
    // Context geometry is explicitly visual, not hidden housing interventions.
    for(let i=0;i<12;i++){const x=(i%4-1.5)*100,z=(Math.floor(i/4)-1)*120-200;if(i===6)continue;const size=26+(i%3)*7,height=12+(i%4)*9;const mesh=new THREE.Mesh(new THREE.BoxGeometry(size,height,size),new THREE.MeshStandardMaterial({color:i%2?'#a5b7ad':'#b7c5bd'}));mesh.position.set(x,height/2,z);scene.add(mesh);const b={id:`context-${i}`,name:'Context building (visual only)',heightMeters:height,poly:[[x-size/2,z-size/2],[x+size/2,z-size/2],[x+size/2,z+size/2],[x-size/2,z+size/2]],center:[x,z]};mesh.userData.contextBuilding=b;mesh.userData.contextBaseColor=mesh.material.color.getHex();town.buildings.push(b)}
    placementContext={buildings:town.buildings.map(b=>({id:b.id,polygon:clone(b.poly)})),districts:[],bounds:town.bounds};options.onPlacementContext?.({...clone(placementContext),suggestedLocation:findBuildableLocation(createBuildingProposal(),placementContext)});
    let yaw=.7,pitch=.68,distance=650,down=null,target=new THREE.Vector3(0,0,0);
    const position=()=>{camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(target)};position();
    const onDown=e=>{if(e.button===0)down={x:e.clientX,y:e.clientY,yaw,pitch}},onMove=e=>{if(!down||attachment?.isPlacing)return;yaw=down.yaw-(e.clientX-down.x)*.007;pitch=Math.max(.2,Math.min(1.4,down.pitch+(e.clientY-down.y)*.005));position()},onUp=()=>down=null,onWheel=e=>{e.preventDefault();distance=Math.max(80,Math.min(1800,distance*Math.exp(e.deltaY*.001)));position()};
    view.addEventListener('pointerdown',onDown);view.addEventListener('pointermove',onMove);doc.defaultView.addEventListener('pointerup',onUp);view.addEventListener('wheel',onWheel,{passive:false});orbitCleanup=()=>{view.removeEventListener('pointerdown',onDown);view.removeEventListener('pointermove',onMove);doc.defaultView.removeEventListener('pointerup',onUp);view.removeEventListener('wheel',onWheel)};
    attachment=attachBuildingWorld({scene,camera,renderer,town,THREE,onPlace:proposal=>{if(proposal)options.onSelect?.({kind:'district',id:proposal.location.districtId||'parcel',label:'Placement parcel',location:clone(proposal.location),placementContext:clone(placementContext)});options.onPlace?.(proposal)},onCancel:options.onCancel,onSelect:selection=>options.onSelect?.({...selection,placementContext:clone(placementContext)}),panel:root.querySelector('.bw-selection'),statusElement:status});await attachment.ready;if(destroyed)return;attachment.update(current);if(queuedPlacement)attachment.beginPlacement(queuedPlacement);
    resize=new ResizeObserver(()=>{const w=Math.max(view.clientWidth,1),h=Math.max(view.clientHeight,1);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()});resize.observe(view);
    const draw=()=>{if(destroyed)return;renderer.render(scene,camera);frame=requestAnimationFrame(draw)};draw();
    status.textContent='Select a building, or propose one to place. Rendered phases come from the selected run.';
  }catch(error){if(!destroyed){status.textContent=`3D view unavailable: ${error.message}. Simulation results remain available.`;root.dataset.error='true'}}})();
  return api;
}
function disposeTree(object){object.traverse?.(child=>{child.geometry?.dispose();for(const material of Array.isArray(child.material)?child.material:[child.material])material?.dispose?.()});object.clear?.()}

export function attachBuildingWorld({scene,camera,renderer,controls,town={},onPlace,onSelect,onCancel,panel,statusElement,THREE:providedThree}) {
  let THREE=providedThree,group=null,ghost=null,draft=null,active=false,destroyed=false,values={projects:[],run:null,month:0,worldVisuals:{}},selectedId=null,beforeIds=new Set(),down=null;
  const canvas=renderer.domElement,doc=canvas.ownerDocument,win=doc.defaultView,listeners=[];let controlsEnabled=controls?.enabled;
  const initialBackground=scene.background?.clone?.()||scene.background;
  const status=text=>{if(statusElement)statusElement.textContent=text};
  const listen=(target,type,handler,opts)=>{target.addEventListener(type,handler,opts);listeners.push(()=>target.removeEventListener(type,handler,opts))};
  const material=(color,opacity=1)=>new THREE.MeshStandardMaterial({color,transparent:opacity<1,opacity,roughness:.75,depthWrite:opacity===1});
  const box=(parent,w,h,d,x,y,z,color,opacity=1)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color,opacity));mesh.position.set(x,y,z);parent.add(mesh);return mesh};
  const selection=(project,state)=>({kind:'building',id:project.id,label:project.name,location:clone(project.location),project:clone(project),state:clone(state)});
  function inspect(project,state){if(!panel)return;panel.hidden=false;panel.replaceChildren();const heading=doc.createElement('strong');heading.textContent=project.name;panel.append(heading);for(const [label,value]of [['Model entity ID',project.id],['Phase',state.status],['Construction',`${Math.round((state.progress||0)*100)}%`],['Floors',`${state.floorsBuilt||0} / ${project.geometry.floors}`],['Month',values.month],['Expected completion',state.expectedCompletionMonth==null?'Not recorded':`Month ${state.expectedCompletionMonth}`],['Planned homes',project.program.residentialUnits],['Affordable homes',project.program.affordableUnits],['Completed units',state.completedUnits||0],['Occupied units',state.occupiedUnits||0],['Public spending',new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0}).format(state.publicCost||0)],['District',project.location.districtId||'Unspecified']]){const row=doc.createElement('div');row.textContent=`${label}: ${value}`;panel.append(row)}
    if(values.run?.projects?.some(row=>row.projectId===project.id)){
      const toggle=doc.createElement('button');toggle.type='button';toggle.dataset.bwBefore=project.id;
      toggle.textContent=beforeIds.has(project.id)?'Show after':'Before / after ghost';toggle.setAttribute('aria-pressed',String(beforeIds.has(project.id)));
      toggle.onclick=()=>{if(beforeIds.has(project.id))beforeIds.delete(project.id);else beforeIds.add(project.id);rebuild()};panel.append(toggle);
      const note=doc.createElement('p');note.textContent=beforeIds.has(project.id)?'Before this intervention: this project was absent. Wireframe marks the recorded project at the selected month. Existing town geometry is unchanged.':'After: recorded project state at the selected month. Occupied units are aggregate households, not linked World residents.';panel.append(note);
    }
  }
  function createProject(project,state,isGhost=false){const g=new THREE.Group();g.userData.projectId=project.id;g.position.set(project.location.x,0,project.location.z);g.rotation.y=-(project.location.rotation||0); // Match validator x/z rotation, not Three’s opposite Y convention.
    const {width:w,depth:d,height:h,floors}=buildingDimensions(project),scale=values.worldVisuals?.heightScale||1;const phase=state.status;const proposed=isGhost||['proposed','approved','permitting'].includes(phase);if(phase==='cancelled')return g;
    if(proposed){box(g,w,h*scale,d,0,h*scale/2,0,'#31c6d6',.24);box(g,w+.6,.3,d+.6,0,.2,0,'#087f8c',.7)}else{
      box(g,w+3,.7,d+3,0,.35,0,phase==='site_prep'?'#846b4c':'#7c8587');
      const built=Math.min(floors,Math.max(0,Math.floor(state.floorsBuilt||0))),floorH=h*scale/floors;
      for(let floor=0;floor<built;floor++){box(g,w,.45,d,0,(floor+1)*floorH,0,'#a4aaa8');for(const x of [-w/2+.5,w/2-.5])for(const z of [-d/2+.5,d/2-.5])box(g,.7,floorH,.7,x,(floor+.5)*floorH,z,'#9ca6a7')}
      if(built&&!['complete','occupied'].includes(phase)){for(const x of [-w/2-1,w/2+1])for(const z of [-d/2-1,d/2+1])box(g,.3,built*floorH,.3,x,built*floorH/2,z,'#c8ab77');for(let floor=1;floor<=built;floor++)box(g,w+2,.2,.3,0,floor*floorH,d/2+1,'#c8ab77')}
      const enclosed=['envelope','interior','complete','occupied'].includes(phase);
      if(enclosed&&built){const facade=values.worldVisuals?.facadeColor||'#d0b79a';box(g,w,built*floorH,d,0,built*floorH/2,0,facade);const occupancy=Math.max(0,Math.min(1,(state.occupiedUnits||0)/(project.program.residentialUnits||1)));for(let floor=0;floor<built;floor++)for(let col=0;col<4;col++){const lit=phase==='occupied'&&((floor*7+col*3)%17)/17<occupancy;const window=box(g,w/7,floorH*.4,.15,(col-1.5)*w/5,(floor+.55)*floorH,d/2+.1,lit?'#ffe5a0':'#487282');if(lit){window.material.emissive.set('#ffe5a0');window.material.emissiveIntensity=.6+(values.worldVisuals?.nightBrightness||0)}}}
      if(values.worldVisuals?.showCranes!==false&&!['complete','occupied'].includes(phase)){const craneH=Math.max(h*scale+8,20);box(g,.8,craneH,.8,w/2+5,craneH/2,0,'#d8a634');box(g,w+18,.7,.7,3,craneH,0,'#d8a634');box(g,.2,Math.max(3,craneH-built*floorH),.2,-w/3,(craneH+built*floorH)/2,0,'#6c746c')}
    }
    g.traverse(mesh=>{if(mesh.isMesh)mesh.userData.projectId=project.id});if(beforeIds.has(project.id)&&!isGhost)g.traverse(mesh=>{if(mesh.isMesh){mesh.material.wireframe=true;mesh.material.transparent=true;mesh.material.opacity=.25;mesh.material.depthWrite=false;mesh.material.color.set('#89e7ef')}});
    return g;
  }
  function rebuild(){if(!group||destroyed)return;disposeTree(group);for(const project of values.projects||[]){const state=buildingStateAtMonth(values.run,project,values.month);group.add(createProject(project,state));if(project.id===selectedId)inspect(project,state)}const density=values.worldVisuals?.treeDensity??.35;for(let i=0;i<Math.round(density*18);i++){const x=300+Math.sin(i*2.4)*100,z=-240+i*18;box(group,1.5,7,1.5,x,3.5,z,'#806447');const crown=new THREE.Mesh(new THREE.ConeGeometry(6,14,6),material('#668260'));crown.position.set(x,13,z);group.add(crown)}if(draft){ghost=createProject(draft,{status:'proposed'},true);group.add(ghost);paintGhost()}else ghost=null;scene.background=values.worldVisuals?.skyColor?new THREE.Color(values.worldVisuals.skyColor):initialBackground}
  function check(){return validateBuildingPlacement(draft,{buildings:[...(town.buildings||[]).map(b=>({...b,polygon:b.polygon||b.poly})),...(values.projects||[]).filter(p=>p.id!==draft.id)],districts:town.districts||[],bounds:town.bounds||{minX:-1500,maxX:1500,minZ:-1500,maxZ:1500}})}
  function paintGhost(){if(!draft||!ghost)return;const checked=check();ghost.traverse(mesh=>{if(mesh.material)mesh.material.color.set(checked.valid?'#31c6d6':'#dc6354')});status(checked.valid?'Click to place draft · R rotate · +/− footprint · Esc cancel. Approval is separate.':`Cannot place: ${checked.errors.join(' ')}`)}
  function point(event){const rect=canvas.getBoundingClientRect(),p=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(p,camera);return ray}
  function move(event){if(!draft||!group)return;const hit=point(event).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());if(hit){draft.location.x=Math.round(hit.x);draft.location.z=Math.round(hit.z);ghost?.position.set(draft.location.x,0,draft.location.z);paintGhost()}}
  function cancel(){const wasActive=active;draft=null;active=false;if(controls)controls.enabled=controlsEnabled;rebuild();if(wasActive)status('Placement cancelled. Approved inputs were not changed.')}
  const api={selectProject(id){selectedId=id;const project=values.projects?.find(p=>p.id===id);if(project){const state=buildingStateAtMonth(values.run,project,values.month);inspect(project,state);onSelect?.(selection(project,state))}},update(next){values={...values,...next};rebuild()},beginPlacement(proposal){draft=clone(proposal);active=true;if(controls){controlsEnabled=controls.enabled;controls.enabled=false}rebuild();status('Move over ground to position the draft. Click places it for review; approval is separate.')},cancelPlacement:cancel,get isPlacing(){return active},destroy(){destroyed=true;for(const off of listeners)off();if(controls&&active)controls.enabled=controlsEnabled;if(group){scene.remove(group);disposeTree(group)}if(panel)panel.hidden=true},ready:null};
  api.ready=(async()=>{THREE=THREE||await import('/vendor/three/three.module.js');if(destroyed)return;group=new THREE.Group();group.name='decision-construction-projects';scene.add(group);rebuild();listen(canvas,'pointermove',move);listen(canvas,'pointerdown',e=>{down=[e.clientX,e.clientY]},true);listen(canvas,'pointerup',event=>{if(!down||Math.hypot(event.clientX-down[0],event.clientY-down[1])>6)return;if(draft){event.stopImmediatePropagation();const checked=check();if(!checked.valid){paintGhost();return}const placed=clone(draft);cancel();status('Draft placed. Review its location and approve in the project editor.');onPlace?.(placed);return}const hits=point(event).intersectObjects(group.children,true);const hit=hits.find(h=>h.object.userData.projectId);if(hit){event.stopImmediatePropagation();selectedId=hit.object.userData.projectId;const project=values.projects.find(p=>p.id===selectedId),state=buildingStateAtMonth(values.run,project,values.month);inspect(project,state);onSelect?.(selection(project,state))}else{const existing=point(event).intersectObjects(scene.children,true).find(h=>h.object.userData.b||h.object.userData.contextBuilding);if(existing){const b=existing.object.userData.b||existing.object.userData.contextBuilding;onSelect?.({kind:'building',id:String(b.id),label:b.name||'Existing building',location:{x:b.center[0],z:b.center[1]},existing:true})}else{const pointOnGround=point(event).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());if(pointOnGround)onSelect?.({kind:'district',id:'neighborhood',label:'Selected neighborhood parcel',location:{x:Math.round(pointOnGround.x),z:Math.round(pointOnGround.z)}})}}},true);listen(win,'keydown',event=>{if(!draft||typing(event.target))return;if(event.key==='Escape'){event.preventDefault();cancel();if(onCancel)onCancel();else onPlace?.(null);return}if(event.key.toLowerCase()==='r'){draft.location.rotation=(draft.location.rotation||0)+Math.PI/4;event.preventDefault();rebuild()}if(['+','=','-','_'].includes(event.key)){draft.geometry.footprintSqFt=Math.max(100,Math.round(draft.geometry.footprintSqFt*((event.key==='-'||event.key==='_') ? .9 : 1.1)));event.preventDefault();rebuild()}});})();return api;
}
