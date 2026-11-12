import { createMediaPreferences } from '../../../shared/media/preferences.js';
import { assertFrameIntegrity, assertHistoryIntegrity } from '../integrity.js';
import {createRendererBackend} from './renderer-backend.js';
import {createCanvasStage,fitCanvasCamera} from './canvas-stage.js';
import {createVisualEffects, recordedEntityLabel} from './effects.js';
import {createSpatialMapping} from './mapping.js';

/** Synchronous host API; renderer loading is deferred so fallback remains usable. */
export function createStage(container, {onSelect,history,onCameraInteraction} = {}) {
  if (history) assertHistoryIntegrity(history);
  const doc = container.ownerDocument;
  const preferences = createMediaPreferences(doc.defaultView);
  let unsubscribeMotion = () => {};
  const root = doc.createElement('section');
  root.setAttribute('aria-label', 'Synchronized City comparison');
  root.style.cssText = 'position:relative;min-height:300px;background:#10232d;color:#eef6fb;border-radius:12px;overflow:hidden';
  const legend = doc.createElement('p'), status = doc.createElement('p'), views = doc.createElement('div'), list = doc.createElement('div');
  legend.style.cssText = status.style.cssText = 'margin:8px 12px;font:12px/1.5 system-ui';
  views.style.cssText = 'position:relative;height:clamp(280px,32vw,400px);touch-action:none';
  list.style.cssText='display:flex;gap:12px;max-height:180px;overflow:auto;padding:8px 12px';
  const labels=doc.createElement('div');labels.dataset.nativeCityLabels='true';labels.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';views.append(labels);root.append(legend,status,views,list); container.append(root);
  const qualityLabel=doc.createElement('label'), qualitySelect=doc.createElement('select'), qualityNote=doc.createElement('p');
  qualityLabel.textContent='Rendering quality ';
  qualityLabel.style.cssText='display:block;margin:8px 12px;font:14px system-ui';
  qualitySelect.setAttribute('aria-label','Rendering quality');
  qualitySelect.style.cssText='max-width:100%;min-height:44px';
  for(const [value,text] of [['standard','Standard'],['power-saving','Power saving · lower resolution']]) {
    const option=doc.createElement('option');option.value=value;option.textContent=text;qualitySelect.append(option);
  }
  qualityNote.textContent='Power saving lowers display resolution. Model results, metrics and receipts stay the same. Switch back to Standard anytime.';
  qualityNote.style.cssText='margin:8px 12px;font:12px/1.5 system-ui';
  qualityLabel.append(qualitySelect);root.insertBefore(qualityLabel,views);root.insertBefore(qualityNote,views);
  let quality='standard';
  const pixelRatio=(canvas=false)=>Math.min(globalThis.devicePixelRatio||1,quality==='power-saving' ? .75 : canvas ? 2 : 1.5);
  qualitySelect.onchange=()=>api.setQuality(qualitySelect.value);
  const cameraBar=doc.createElement('div'), saveView=doc.createElement('button'), restoreView=doc.createElement('button'), bookmarkStatus=doc.createElement('p');
  cameraBar.style.cssText='display:flex;flex-wrap:wrap;gap:8px;padding:8px 12px';
  saveView.type=restoreView.type='button';saveView.textContent='Save view';restoreView.textContent='Restore view';
  saveView.disabled=restoreView.disabled=true;
  bookmarkStatus.setAttribute('role','status');bookmarkStatus.style.cssText='margin:0 12px 8px;font:12px system-ui';
  bookmarkStatus.textContent='No view saved. Bookmark lasts until a new comparison or page reload.';
  cameraBar.append(saveView,restoreView);views.before(cameraBar,bookmarkStatus);
  let bookmark=null;
  function refreshBookmarkControls(){saveView.disabled=disposed||!projection||!(canvasStage||renderReady&&renderer);restoreView.disabled=saveView.disabled||!bookmark;}
  saveView.onclick=()=>api.saveCameraBookmark();restoreView.onclick=()=>api.restoreCameraBookmark();
  const mapping = createSpatialMapping();
  const retained=new Map(), labelNodes=new Map();
  let draws=0;
  let fitRows=null;
  if(history){const all=new Map();for(let month=0;month<=120;month++){const a=history.baseline[month]?.state,b=history.plan[month]?.state;if(a&&b){const projection=mapping.frame(a,b);for(const row of [...projection.a,...projection.b])all.set(`${row.collection}:${row.id}`,row);}}fitRows=[...all.values()];}
  let renderReady=false,renderBackend='pending',backendReason=null,resolveReady;const ready=new Promise(resolve=>{resolveReady=resolve;});
  let disposed=false, mode='split', ghosts=true, projection=null, renderer=null, THREE, controls, camera, scenes=[], meshes=[], selected=null, error=null;
  let cameraTransition=null;let currentFrame=null;let width=1,height=1, canvasStage=null, effects=null, currentDiff=null, animation=null;
  const changedKeys=()=>new Set((currentDiff?.entities||[]).filter(e=>e.physical||e.collection==='projects').map(e=>`${e.collection}:${e.id}`));
  const changed=row=>changedKeys().has(`${row.collection}:${row.id}`);
  const resize=()=>{ width=Math.max(1,views.clientWidth);height=Math.max(1,views.clientHeight);renderer?.setSize(width,height,false);draw(); };
  const observer=globalThis.ResizeObserver ? new ResizeObserver(resize) : null;
  observer?.observe(views);globalThis.addEventListener?.('resize',resize);
  function releaseMeshes() {
    for(const mesh of meshes) disposeMesh(mesh);
    retained.clear();meshes=[];
  }
  function disposeMesh(mesh) {
    effects?.remove(mesh);
    mesh.parent?.remove(mesh);
    mesh.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
  }

  function color(row,ghost) {
    return selected?.id===row.id&&selected?.collection===row.collection?0xffcf62:changed(row)?0xb9f488:row.collection==='projects'?0xd5ab67:ghost?0x89e7ef:0x80afba;
  }
  function geometryFor(row) {
    if(!row.polygon)return new THREE.BoxGeometry(14,row.height,14);
    const shape=new THREE.Shape();row.polygon.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:row.height,bevelEnabled:false});geometry.rotateX(-Math.PI/2);return geometry;
  }
  function add(row,scene,arm,ghost=false) {
    const geometry=geometryFor(row);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:color(row,ghost),transparent:ghost,opacity:ghost?.25:1,wireframe:ghost,roughness:.65,emissiveIntensity:.5}));
    if(!row.polygon)mesh.position.set(row.x,row.height/2,row.z);
    effects?.apply(mesh,row,{changed:changed(row),selected:selected?.collection===row.collection&&selected?.id===row.id,ghost,kind:row.collection});
    if(!ghost){const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:changed(row)?0xe9ffd0:0xb4d8e6,transparent:true,opacity:.5}));mesh.add(edges);}
    mesh.userData={collection:row.collection,id:row.id,arm,ghost};scene.add(mesh);meshes.push(mesh);
    // Recorded work gauge above a project marker; never unfinished building floors.
    if(row.construction&&!ghost&&row.construction.progressRatio!==null){
      const ratio=row.construction.progressRatio;
      const track=new THREE.Mesh(new THREE.BoxGeometry(18,.7,3),new THREE.MeshBasicMaterial({color:0x344b5b}));track.position.set(0,row.height/2+3,0);mesh.add(track);
      const fill=new THREE.Mesh(new THREE.BoxGeometry(18,.8,3.2),new THREE.MeshBasicMaterial({color:0xffdb85}));fill.scale.x=ratio;fill.visible=ratio>0;fill.position.set(-9+9*ratio,row.height/2+3,0);mesh.add(fill);
    }
    return mesh;
  }
  function rebuild() {
    if(!renderer||!projection)return;
    const wanted=new Set();
    function retain(row,side,ghost=false) {
      const arm=side?'plan':'baseline',key=`${arm}:${row.collection}:${row.id}:${ghost}`;
      wanted.add(key);
      let mesh=retained.get(key);
      const shape=JSON.stringify([row.height,row.polygon]);
      if(mesh&&mesh.recordedShape!==shape){
        mesh.geometry.dispose();mesh.geometry=geometryFor(row);
        if(!ghost){const edges=mesh.children[0];edges.geometry.dispose();edges.geometry=new THREE.EdgesGeometry(mesh.geometry);}
        for(const child of mesh.children.slice(1))child.position.y=row.height/2+3;
      }
      if(!mesh){mesh=add(row,scenes[side],arm,ghost);retained.set(key,mesh);}
      else {
        if(!row.polygon){mesh.position.x=row.x;mesh.position.z=row.z;if(mesh.recordedShape!==shape)mesh.position.y=row.height/2;}else mesh.position.set(0,0,0);
        mesh.material.color.set(color(row,ghost));
        if(!ghost)mesh.children[0].material.color.set(changed(row)?0xe9ffd0:0xb4d8e6);
        effects?.apply(mesh,row,{changed:changed(row),selected:selected?.collection===row.collection&&selected?.id===row.id,ghost,kind:row.collection});
        const fill=mesh.children[2],ratio=row.construction?.progressRatio;
        if(fill&&ratio!=null){fill.scale.x=ratio;fill.visible=ratio>0;fill.position.x=-9+9*ratio;}
      }
      mesh.recordedShape=shape;
      mesh.visible=mode!=='difference'||changed(row);
    }
    for(const [side,records] of [projection.a,projection.b].entries()) {
      for(const row of records)retain(row,side);
      if(ghosts)for(const row of side?projection.a:projection.b)if(!records.some(r=>r.collection===row.collection&&r.id===row.id))retain(row,side,true);
    }
    for(const [key,mesh] of retained)if(!wanted.has(key)){disposeMesh(mesh);retained.delete(key);}
    meshes=[...retained.values()];
    draw();
  }
  function draw() {
    if(!renderer||!camera||!renderReady||disposed)return;
    renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.clear();renderer.setScissorTest(true);
    const arms=['split','difference'].includes(mode)?[0,1]:[mode==='plan'?1:0];
    const segment=width/arms.length;
    camera.aspect=segment/height;camera.fov=Math.min(110,2*Math.atan(Math.tan(Math.PI/8)*Math.max(1,(width<600?1.8:1.3)/camera.aspect))*180/Math.PI);camera.updateProjectionMatrix();
    arms.forEach((arm,i)=>{renderer.setViewport(i*segment,0,segment,height);renderer.setScissor(i*segment,0,segment,height);renderer.render(scenes[arm],camera);});
    draws++;
    const visibleLabels=new Set();
    arms.forEach((arm,i)=>{const records=arm?projection?.b:projection?.a;if(!records)return;for(const row of records){if(mode==='difference'&&!changed(row))continue;const count=(arm?currentFrame?.plan:currentFrame?.baseline)?.state?.units?.filter(u=>u.buildingId===row.id).length;const isChanged=changed(row);if(!count&&!isChanged)continue;const point=new THREE.Vector3(row.x,row.height+8,row.z).project(camera);const x=(i+(point.x+1)/2)*segment,y=(1-point.y)/2*height;if(x<i*segment||x>(i+1)*segment||y<0||y>height)continue;const key=`${arm}:${row.collection}:${row.id}`;visibleLabels.add(key);let label=labelNodes.get(key);if(!label){label=doc.createElement('span');labelNodes.set(key,label);labels.append(label);}const text=recordedEntityLabel(row,count,currentDiff,arm?'plan':'baseline');const measureKey=`${text}:${isChanged}:${segment}`;if(label.textContent!==text)label.textContent=text;label.style.cssText=`position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-100%);font:${isChanged?'700 13':'11'}px system-ui;color:${isChanged?'#dcffbd':'#adc9d5'};background:#0a1a24d9;padding:5px 8px;border-radius:5px;white-space:nowrap`;label.style.maxWidth=`${Math.max(1,segment-12)}px`;label.style.overflow="hidden";label.style.textOverflow="ellipsis";
      if(label.measureKey!==measureKey){label.halfWidth=Math.min(label.offsetWidth,Math.max(1,segment-12))/2;label.measureKey=measureKey;}
      label.style.left=`${Math.max(i*segment+label.halfWidth+6,Math.min((i+1)*segment-label.halfWidth-6,x))}px`;}});
    for(const [key,label] of labelNodes)if(!visibleLabels.has(key)){label.remove();labelNodes.delete(key);}

  }
  function summary() {
    list.replaceChildren();
    if(!projection)return;
    for(const [side,records] of [projection.a,projection.b].entries()) {
      const section=doc.createElement('div'), title=doc.createElement('strong');title.textContent=side?'WITH PLAN':'WITHOUT PLAN';title.style.cssText='display:block';section.style.cssText='flex:1;min-width:0';section.append(title);
      section.hidden=!['split','difference'].includes(mode)&&mode!==(side?'plan':'baseline');
      for(const row of records) {
        if(mode==='difference'&&!changed(row))continue;
        const button=doc.createElement('button');button.type='button';button.style.cssText='display:inline-block;margin:4px 4px 0 0;font:11px system-ui;padding:5px 7px;min-height:32px';
        button.textContent=`${row.id}${row.construction?` · ${row.construction.stage??"stage unavailable"} · ${row.construction.units??"unavailable"} planned homes`:""} · ${row.mapping === 'synthetic-layout'?'schematic · unlocated':'OSM footprint'}${row.progress===undefined?'':` · recorded progress ${Math.round(row.progress*100)}%`}`;
        button.onclick=()=>onSelect?.({collection:row.collection,id:row.id,arm:side?'plan':'baseline'});section.append(button);
      }
      list.append(section);
    }
  }
  function fit() {
    if(!camera||!projection)return;
    const rows=fitRows||[...projection.a,...projection.b];if(!rows.length)return;
    const xs=rows.flatMap(r=>r.polygon?r.polygon.map(p=>p[0]):[r.x-8,r.x+8]),zs=rows.flatMap(r=>r.polygon?r.polygon.map(p=>p[1]):[r.z-8,r.z+8]);
    const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2,r=Math.max(40,Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs))*.55;
    controls.target.set(x,0,z);camera.position.set(x+r,r,z+r);controls.update();draw();
  }
  function pick(event) {
    if(!renderer||!projection)return;
    const box=views.getBoundingClientRect(),x=event.clientX-box.left,y=event.clientY-box.top;
    const arm=['split','difference'].includes(mode)?(x<width/2?0:1):(mode==='plan'?1:0),segment=['split','difference'].includes(mode)?width/2:width;
    const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(((x%segment)/segment)*2-1,1-y/height*2),camera);
    const hit=ray.intersectObjects(meshes.filter(m=>m.visible&&m.parent===scenes[arm]&&!m.userData.ghost),false)[0];
    if(hit){const {collection,id,arm}=hit.object.userData;onSelect?.({collection,id,arm});}
  }
  views.addEventListener('click',pick);
  // Native ESM uses the host's same-version curated Three import map.
  const canvasSelected=['canvas','canvas2d'].includes(new URLSearchParams(location.search).get('renderer'));
  let importExpired=false;
  const importDeadline=canvasSelected?null:setTimeout(()=>{importExpired=true;fail(new Error('Three loading timed out after 10 seconds'));},10000);
  (canvasSelected?Promise.reject(new Error('Canvas2D selected')):Promise.all([import('three'),import('three/addons/controls/OrbitControls.js')])).then(async ([module,{OrbitControls}])=>{
    clearTimeout(importDeadline);if(disposed||importExpired||canvasStage)return;THREE=module;
    effects=createVisualEffects({THREE,reducedMotion:preferences.get().reducedMotion});
    const selectedBackend=await createRendererBackend({THREE,forceWebGL:new URLSearchParams(location.search).get('renderer')==='webgl'});if(disposed){selectedBackend.renderer.dispose();return;}renderer=selectedBackend.renderer;renderBackend=selectedBackend.backend;backendReason=selectedBackend.reason;renderer.autoClear=false;renderer.setClearColor(0x10232d,1);renderer.setPixelRatio(pixelRatio());
    renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-keyshortcuts','PageUp PageDown d');views.append(renderer.domElement);renderer.domElement.style.cssText='display:block;width:100%;height:100%';renderer.domElement.setAttribute('aria-label','City inventory scenes; drag to orbit, scroll to zoom');
    scenes=[0,1].map(()=>{const scene=new THREE.Scene();scene.background=renderBackend==='webgpu'?null:new THREE.Color(0x10232d);scene.add(new THREE.HemisphereLight(0xdfeeff,0x425449,2));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(50,100,60);scene.add(sun);const grid=new THREE.GridHelper(600,25,0x456070,0x203746);grid.position.y=-.1;scene.add(grid);return scene;});
    camera=new THREE.PerspectiveCamera(45,1,.1,100000);camera.position.set(100,100,100);
    controls=new OrbitControls(camera,renderer.domElement);controls.addEventListener('change',draw);controls.enableDamping=false;controls.addEventListener('start',()=>{cameraTransition=null;onCameraInteraction?.();});
    renderer.domElement.addEventListener('webglcontextlost',lost);
    resize();rebuild();fit();if(selected)api.focus(selected);
    if(renderBackend==='webgpu'&&renderer.compileAsync){let timeout;try{await Promise.race([(async()=>{for(const scene of scenes)await renderer.compileAsync(scene,camera);})(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('GPU shader preparation timed out')),8000);})]);}finally{clearTimeout(timeout);}}
    if(disposed)return;renderReady=true;refreshBookmarkControls();draw();resolveReady({backend:renderBackend});
    if(renderBackend==='webgpu')renderer.backend?.device?.lost?.then(info=>{if(!disposed)fail(new Error(`WebGPU device lost: ${info.message||info.reason}`));});
    const animate=now=>{if(disposed||canvasStage)return;if(cameraTransition){const t=Math.min(1,(now-cameraTransition.start)/1200),smooth=t*t*(3-2*t);camera.position.lerpVectors(cameraTransition.position,cameraTransition.endPosition,smooth);controls.target.lerpVectors(cameraTransition.target,cameraTransition.endTarget,smooth);controls.update();if(t===1)cameraTransition=null;draw();}if(effects?.tick(now))draw();animation=requestAnimationFrame(animate);};animation=requestAnimationFrame(animate);
    status.textContent=(renderBackend==='webgpu'?'WebGPU · ':'WebGL · ')+(projection?.physicalDifference?'Recorded building differences · wireframe ghosts show presence in the other future.':'No recorded physical building difference at this month.');
  }).catch(reason=>{clearTimeout(importDeadline);fail(reason);});
  function lost(event) {event.preventDefault();fail(new Error('Graphics context lost'));}
  function fail(reason) {if(disposed||canvasStage)return;bookmark=null;bookmarkStatus.textContent='No view saved. Bookmark lasts until a new comparison or page reload.';error=reason?.message||'Graphics unavailable';status.textContent='Canvas2D low-fidelity view · same recorded City inventory, camera and timeline.';controls?.dispose();effects?.dispose();if(animation)cancelAnimationFrame(animation);releaseMeshes();renderer?.dispose();renderer?.domElement.remove();renderer=null;labels.replaceChildren();labelNodes.clear();try{canvasStage=createCanvasStage(views,{onSelect,onCameraInteraction});canvasStage.setPixelRatio(pixelRatio(true));canvasStage.setMode(mode);canvasStage.setGhosts(ghosts);if(projection){canvasStage.update(projection,currentDiff);if(fitRows)canvasStage.setCamera(fitCanvasCamera({a:fitRows,b:fitRows},views.clientWidth,views.clientHeight,mode));if(selected)canvasStage.focus(selected);}}catch(fallbackError){canvasStage?.dispose();canvasStage=null;error=`${error}; ${fallbackError.message}`;views.hidden=true;status.textContent='Graphics unavailable. The exact recorded inventory, timeline, outcomes and WHY controls remain available below.';}refreshBookmarkControls();resolveReady({backend:canvasStage?'canvas2d':'inventory-fallback'});}
  unsubscribeMotion = preferences.subscribe(state => {
    if (state.reducedMotion && cameraTransition) {
      camera.position.copy(cameraTransition.endPosition);controls.target.copy(cameraTransition.endTarget);controls.update();cameraTransition=null;
    }
    effects?.dispose();effects=THREE&&!canvasStage&&!disposed&&!error?createVisualEffects({THREE,reducedMotion:state.reducedMotion}):null;
    if (projection) { rebuild(); draw(); }
  });
  const api={
    whenReady:()=>ready,
    setQuality(value){
      if(!['standard','power-saving'].includes(value))throw new RangeError('Unknown rendering quality');
      if(disposed)return;
      quality=value;qualitySelect.value=value;renderer?.setPixelRatio(pixelRatio());canvasStage?.setPixelRatio(pixelRatio(true));resize();
    },
    update(frame,diff) {
      if(disposed)return;
      if(!frame?.baseline?.state||!frame?.plan?.state){projection=null;refreshBookmarkControls();currentFrame=null;currentDiff=null;selected=null;cameraTransition=null;canvasStage?.update(null,null);releaseMeshes();labels.replaceChildren();labelNodes.clear();list.replaceChildren();legend.textContent='City snapshots unavailable';status.textContent='Both futures are required for a matched scene.';draw();if(frame)assertFrameIntegrity(frame,history);return;}
      assertFrameIntegrity(frame,history);
      currentFrame=frame;currentDiff=diff;const first=!projection;projection=mapping.frame(frame.baseline.state,frame.plan.state);
      legend.textContent=`Month ${frame.month} · ${projection.label}`;
      if(!error)status.textContent=renderBackend==='pending'?'Inventory ready · graphics loading in the background.':(renderBackend==='webgpu'?'WebGPU · ':'WebGL · ')+(projection.physicalDifference?'Recorded building differences · wireframe ghosts show presence in the other future.':'No recorded physical building difference at this month.');
      refreshBookmarkControls();summary();canvasStage?.update(projection,diff);if(first&&canvasStage&&fitRows)canvasStage.setCamera(fitCanvasCamera({a:fitRows,b:fitRows},views.clientWidth,views.clientHeight,mode));rebuild();if(first)fit();
    },
    setMode(value){if(!['split','baseline','plan','difference'].includes(value))throw new TypeError('Unknown scene mode');mode=value;canvasStage?.setMode(value);summary();rebuild();draw();},
    setGhosts(value){ghosts=Boolean(value);canvasStage?.setGhosts(ghosts);rebuild();},
    cancelCamera(){cameraTransition=null;},
    focus(entity,{animate=false,scale='building'}={}){if(disposed||!projection)return false;const row=[...projection.a,...projection.b].find(r=>r.collection===entity?.collection&&r.id===entity.id);if(!row)return false;selected=entity;canvasStage?.focus(entity,{scale});if(camera){cameraTransition=null;const endTarget=new THREE.Vector3(row.x,row.height/2,row.z),endPosition=new THREE.Vector3(row.x+(scale==='neighborhood'?180:60),row.height+(scale==='neighborhood'?180:60),row.z+(scale==='neighborhood'?180:60));if(animate&&!preferences.get().reducedMotion)cameraTransition={start:performance.now(),position:camera.position.clone(),target:controls.target.clone(),endPosition,endTarget};else{controls.target.copy(endTarget);camera.position.copy(endPosition);controls.update();}}rebuild();return true;},
    resetCamera(){cameraTransition=null;if(canvasStage&&projection)canvasStage.setCamera(fitCanvasCamera(fitRows?{a:fitRows,b:fitRows}:projection,views.clientWidth,views.clientHeight,mode));fit();draw();},
    setCamera(value){
      if(disposed||!value||typeof value!=='object')return false;
      if(canvasStage){
        if(!['x','z','zoom'].every(key=>Number.isFinite(value[key]))||Math.abs(value.x)>1000000||Math.abs(value.z)>1000000||value.zoom<.02||value.zoom>32)return false;
        cameraTransition=null;canvasStage.setCamera(value);return true;
      }
      const vector=values=>Array.isArray(values)&&values.length===3&&values.every(v=>Number.isFinite(v)&&Math.abs(v)<=1000000);
      if(!renderReady||!renderer||!camera||!vector(value.position)||!vector(value.target)||value.position.every((v,i)=>v===value.target[i]))return false;
      cameraTransition=null;camera.position.fromArray(value.position);controls.target.fromArray(value.target);controls.update();draw();return true;
    },
    getCamera(){return canvasStage?.getCamera()||{position:camera?.position.toArray()??null,target:controls?.target.toArray()??null,quaternion:camera?.quaternion.toArray()??null,zoom:camera?.zoom??null};},
    saveCameraBookmark(){
      refreshBookmarkControls();if(saveView.disabled)return false;
      onCameraInteraction?.();cameraTransition=null;
      bookmark={backend:canvasStage?'canvas2d':'three',pose:structuredClone(api.getCamera())};
      bookmarkStatus.textContent='View saved for both worlds. Lasts until a new comparison or page reload.';refreshBookmarkControls();return true;
    },
    restoreCameraBookmark(){
      refreshBookmarkControls();if(restoreView.disabled)return false;
      onCameraInteraction?.();cameraTransition=null;
      if(bookmark.backend==='canvas2d')canvasStage.setCamera(bookmark.pose);
      else {
        controls.target.fromArray(bookmark.pose.target);
        camera.position.fromArray(bookmark.pose.position);camera.zoom=bookmark.pose.zoom;
        controls.update();camera.quaternion.fromArray(bookmark.pose.quaternion);
        camera.updateProjectionMatrix();draw();
      }
      bookmarkStatus.textContent='Saved view restored in both worlds.';return true;
    },
    getStats(){const arms=['split','difference'].includes(mode)?[0,1]:[mode==='plan'?1:0];const segment=width/arms.length;const targets=camera?meshes.filter(m=>m.visible&&!m.userData.ghost&&arms.includes(m.parent===scenes[0]?0:1)).map(m=>{const arm=m.parent===scenes[0]?0:1;const v=m.position.clone().project(camera);return {...m.userData,meshId:m.uuid,height:m.geometry.parameters?.height??null,scaleY:m.scale.y,x:(arms.indexOf(arm)+(v.x+1)/2)*segment,y:(1-v.y)/2*height};}):[];return {...canvasStage?.getStats(),quality,pixelRatio:pixelRatio(Boolean(canvasStage)),targets,camera:api.getCamera(),mode,disposed,backend:disposed?'disposed':canvasStage?'canvas2d':error?'inventory-fallback':renderReady&&renderer?renderBackend:'pending',backendReason,objects:canvasStage?canvasStage.getStats().objects:meshes.length,draws,geometries:renderer?.info?.memory?.geometries??null,textures:renderer?.info?.memory?.textures??null,month:projection?.month??null,layoutVersion:mapping.version,error};},
    dispose(){if(disposed)return;disposed=true;bookmark=null;saveView.onclick=restoreView.onclick=null;refreshBookmarkControls();qualitySelect.onchange=null;clearTimeout(importDeadline);unsubscribeMotion();preferences.dispose();observer?.disconnect();globalThis.removeEventListener?.('resize',resize);canvasStage?.dispose();effects?.dispose();if(animation)cancelAnimationFrame(animation);views.removeEventListener('click',pick);renderer?.domElement.removeEventListener('webglcontextlost',lost);controls?.dispose();releaseMeshes();for(const scene of scenes)scene.traverse(object=>{if(object.geometry){object.geometry.dispose();if(Array.isArray(object.material))object.material.forEach(material=>material.dispose());else object.material.dispose();}});effects?.dispose();renderer?.dispose();renderer=null;root.remove();resolveReady({backend:'disposed'});},
  };
  return api;
}
