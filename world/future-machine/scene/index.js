import { createMediaPreferences } from '../../../shared/media/preferences.js';
import {createRendererBackend} from './renderer-backend.js';
import {createCanvasStage,fitCanvasCamera} from './canvas-stage.js';
import {createVisualEffects} from './effects.js';
import {createSpatialMapping} from './mapping.js';

/** Synchronous host API; renderer loading is deferred so fallback remains usable. */
export function createStage(container, {onSelect,history} = {}) {
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
  const mapping = createSpatialMapping();
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
    effects?.dispose();effects=THREE&&!canvasStage&&!disposed&&!error?createVisualEffects({THREE,reducedMotion:preferences.get().reducedMotion}):null;
    for(const mesh of meshes) {mesh.parent?.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();for(const child of mesh.children){child.geometry?.dispose();child.material?.dispose();}}
    meshes=[];
  }
  function material(row, ghost) {
    const focused=selected?.id===row.id&&selected?.collection===row.collection;
    return new THREE.MeshStandardMaterial({color:focused?0xffcf62:changed(row)?0xb9f488:row.collection==='projects'?0xd5ab67:ghost?0x89e7ef:0x80afba,transparent:ghost,opacity:ghost?.25:1,wireframe:ghost,roughness:.65,emissive:focused?0x9b6414:changed(row)?0x2a5420:0x000000,emissiveIntensity:.5});
  }
  function add(row,scene,arm,ghost=false) {
    let geometry;
    if(row.polygon) {
      const shape=new THREE.Shape();row.polygon.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
      geometry=new THREE.ExtrudeGeometry(shape,{depth:row.height,bevelEnabled:false});geometry.rotateX(-Math.PI/2);
    } else geometry=new THREE.BoxGeometry(14,row.height,14);
    const mesh=new THREE.Mesh(geometry,material(row,ghost));
    if(!row.polygon)mesh.position.set(row.x,row.height/2,row.z);
    effects?.apply(mesh,row,{changed:changed(row),selected:selected?.collection===row.collection&&selected?.id===row.id,ghost,kind:row.collection});
    if(!ghost){const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:changed(row)?0xe9ffd0:0xb4d8e6,transparent:true,opacity:.5}));mesh.add(edges);}
    mesh.userData={collection:row.collection,id:row.id,arm,ghost};scene.add(mesh);meshes.push(mesh);
    // Recorded work gauge above a project marker; never unfinished building floors.
    if(row.construction&&!ghost&&row.construction.progressRatio!==null){
      const ratio=row.construction.progressRatio;
      const track=new THREE.Mesh(new THREE.BoxGeometry(18,.7,3),new THREE.MeshBasicMaterial({color:0x344b5b}));track.position.set(0,row.height/2+3,0);mesh.add(track);
      if(ratio>0){const fill=new THREE.Mesh(new THREE.BoxGeometry(18*ratio,.8,3.2),new THREE.MeshBasicMaterial({color:0xffdb85}));fill.position.set(-9+9*ratio,row.height/2+3,0);mesh.add(fill);}
    }
  }
  function rebuild() {
    if(!renderer||!projection)return;
    releaseMeshes();
    for(const [side,records] of [projection.a,projection.b].entries()) {
      for(const row of records)if(mode!=='difference'||changed(row))add(row,scenes[side],side?'plan':'baseline');
      if(ghosts) {
        const other=side?projection.a:projection.b;
        for(const row of other) if((mode!=='difference'||changed(row))&&!records.some(r=>r.collection===row.collection&&r.id===row.id))add(row,scenes[side],side?'plan':'baseline',true);
      }
    }
    draw();
  }
  function draw() {
    if(!renderer||!camera||!renderReady||disposed)return;
    renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.clear();renderer.setScissorTest(true);
    const arms=['split','difference'].includes(mode)?[0,1]:[mode==='plan'?1:0];
    const segment=width/arms.length;
    camera.aspect=segment/height;camera.fov=Math.min(110,2*Math.atan(Math.tan(Math.PI/8)*Math.max(1,(width<600?1.8:1.3)/camera.aspect))*180/Math.PI);camera.updateProjectionMatrix();
    arms.forEach((arm,i)=>{renderer.setViewport(i*segment,0,segment,height);renderer.setScissor(i*segment,0,segment,height);renderer.render(scenes[arm],camera);});
    labels.replaceChildren();
    arms.forEach((arm,i)=>{const records=arm?projection?.b:projection?.a;if(!records)return;for(const row of records){if(mode==='difference'&&!changed(row))continue;const count=(arm?currentFrame?.plan:currentFrame?.baseline)?.state?.units?.filter(u=>u.buildingId===row.id).length;const isChanged=changed(row);if(!count&&!isChanged)continue;const point=new THREE.Vector3(row.x,row.height+8,row.z).project(camera);const x=(i+(point.x+1)/2)*segment,y=(1-point.y)/2*height;if(x<i*segment||x>(i+1)*segment||y<0||y>height)continue;const label=doc.createElement('span');label.textContent=count?`${count} homes${isChanged?' · added':''}`:`Project · ${row.construction?.stage??"stage unavailable"} · ${row.construction?.progressRatio==null?"progress unavailable":Math.round(row.construction.progressRatio*100)+"% work"}`;label.style.cssText=`position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-100%);font:${isChanged?'700 13':'11'}px system-ui;color:${isChanged?'#dcffbd':'#adc9d5'};background:#0a1a24d9;padding:5px 8px;border-radius:5px;white-space:nowrap`;labels.append(label);const half=Math.min(label.offsetWidth,segment-12)/2;label.style.maxWidth=`${segment-12}px`;label.style.overflow="hidden";label.style.textOverflow="ellipsis";label.style.left=`${Math.max(i*segment+half+6,Math.min((i+1)*segment-half-6,x))}px`;}});
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
        button.textContent=`${row.id}${row.construction?` · ${row.construction.stage??"stage unavailable"} · ${row.construction.units??"unavailable"} planned homes`:""} · ${row.mapping === 'synthetic-layout'?'schematic':'OSM footprint'}${row.progress===undefined?'':` · recorded progress ${Math.round(row.progress*100)}%`}`;
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
    const hit=ray.intersectObjects(meshes.filter(m=>m.parent===scenes[arm]&&!m.userData.ghost))[0];
    if(hit)onSelect?.({...hit.object.userData,ghost:undefined});
  }
  views.addEventListener('click',pick);
  // Native ESM uses the host's same-version curated Three import map.
  Promise.all([import('three'),import('three/addons/controls/OrbitControls.js')]).then(async ([module,{OrbitControls}])=>{
    if(disposed||canvasStage)return;THREE=module;
    if(new URLSearchParams(location.search).get('renderer')&&['canvas','canvas2d'].includes(new URLSearchParams(location.search).get('renderer'))){fail(new Error('Canvas2D selected'));return;}
    effects=createVisualEffects({THREE,reducedMotion:preferences.get().reducedMotion});
    const selectedBackend=await createRendererBackend({THREE,forceWebGL:new URLSearchParams(location.search).get('renderer')==='webgl'});if(disposed){selectedBackend.renderer.dispose();return;}renderer=selectedBackend.renderer;renderBackend=selectedBackend.backend;backendReason=selectedBackend.reason;renderer.autoClear=false;renderer.setClearColor(0x10232d,1);renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));
    views.append(renderer.domElement);renderer.domElement.style.cssText='display:block;width:100%;height:100%';renderer.domElement.setAttribute('aria-label','City inventory scenes; drag to orbit, scroll to zoom');
    scenes=[0,1].map(()=>{const scene=new THREE.Scene();scene.background=renderBackend==='webgpu'?null:new THREE.Color(0x10232d);scene.add(new THREE.HemisphereLight(0xdfeeff,0x425449,2));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(50,100,60);scene.add(sun);const grid=new THREE.GridHelper(600,25,0x456070,0x203746);grid.position.y=-.1;scene.add(grid);return scene;});
    camera=new THREE.PerspectiveCamera(45,1,.1,100000);camera.position.set(100,100,100);
    controls=new OrbitControls(camera,renderer.domElement);controls.addEventListener('change',draw);controls.enableDamping=false;controls.addEventListener('start',()=>{cameraTransition=null;});
    renderer.domElement.addEventListener('webglcontextlost',lost);
    resize();rebuild();fit();
    if(renderBackend==='webgpu'&&renderer.compileAsync){let timeout;try{await Promise.race([(async()=>{for(const scene of scenes)await renderer.compileAsync(scene,camera);})(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('GPU shader preparation timed out')),8000);})]);}finally{clearTimeout(timeout);}}
    if(disposed)return;renderReady=true;draw();resolveReady({backend:renderBackend});
    if(renderBackend==='webgpu')renderer.backend?.device?.lost?.then(info=>{if(!disposed)fail(new Error(`WebGPU device lost: ${info.message||info.reason}`));});
    const animate=now=>{if(disposed||canvasStage)return;if(cameraTransition){const t=Math.min(1,(now-cameraTransition.start)/1200),smooth=t*t*(3-2*t);camera.position.lerpVectors(cameraTransition.position,cameraTransition.endPosition,smooth);controls.target.lerpVectors(cameraTransition.target,cameraTransition.endTarget,smooth);controls.update();if(t===1)cameraTransition=null;draw();}if(effects?.tick(now))draw();animation=requestAnimationFrame(animate);};animation=requestAnimationFrame(animate);
    status.textContent=(renderBackend==='webgpu'?'WebGPU · ':'WebGL · ')+(projection?.physicalDifference?'Recorded building differences · wireframe ghosts show presence in the other future.':'No recorded physical building difference at this month.');
  }).catch(fail);
  function lost(event) {event.preventDefault();fail(new Error('Graphics context lost'));}
  function fail(reason) {if(disposed||canvasStage)return;error=reason?.message||'Graphics unavailable';status.textContent='Canvas2D low-fidelity view · same recorded City inventory, camera and timeline.';controls?.dispose();effects?.dispose();if(animation)cancelAnimationFrame(animation);releaseMeshes();renderer?.dispose();renderer?.domElement.remove();renderer=null;labels.replaceChildren();try{canvasStage=createCanvasStage(views,{onSelect});canvasStage.setMode(mode);canvasStage.setGhosts(ghosts);if(projection){canvasStage.update(projection,currentDiff);if(fitRows)canvasStage.setCamera(fitCanvasCamera({a:fitRows,b:fitRows},views.clientWidth,views.clientHeight,mode));}}catch(fallbackError){canvasStage?.dispose();canvasStage=null;error=`${error}; ${fallbackError.message}`;views.hidden=true;status.textContent='Graphics unavailable. The exact recorded inventory, timeline, outcomes and WHY controls remain available below.';}resolveReady({backend:canvasStage?'canvas2d':'inventory-fallback'});}
  unsubscribeMotion = preferences.subscribe(state => {
    if (state.reducedMotion && cameraTransition) {
      camera.position.copy(cameraTransition.endPosition);controls.target.copy(cameraTransition.endTarget);controls.update();cameraTransition=null;
    }
    if (projection) { rebuild(); draw(); }
  });
  const api={
    whenReady:()=>ready,
    update(frame,diff) {
      if(disposed)return;
      if(!frame?.baseline?.state||!frame?.plan?.state){projection=null;releaseMeshes();list.replaceChildren();legend.textContent='City snapshots unavailable';status.textContent='Both futures are required for a matched scene.';draw();return;}
      currentFrame=frame;currentDiff=diff;const first=!projection;projection=mapping.frame(frame.baseline.state,frame.plan.state);
      legend.textContent=`Month ${frame.month} · ${projection.label}`;
      if(!error)status.textContent=(renderBackend==='webgpu'?'WebGPU · ':'WebGL · ')+(projection.physicalDifference?'Recorded building differences · wireframe ghosts show presence in the other future.':'No recorded physical building difference at this month.');
      summary();canvasStage?.update(projection,diff);if(first&&canvasStage&&fitRows)canvasStage.setCamera(fitCanvasCamera({a:fitRows,b:fitRows},views.clientWidth,views.clientHeight,mode));rebuild();if(first)fit();
    },
    setMode(value){if(!['split','baseline','plan','difference'].includes(value))throw new TypeError('Unknown scene mode');mode=value;canvasStage?.setMode(value);summary();rebuild();draw();},
    setGhosts(value){ghosts=Boolean(value);canvasStage?.setGhosts(ghosts);rebuild();},
    focus(entity,{animate=false}={}){if(disposed||!projection)return false;const row=[...projection.a,...projection.b].find(r=>r.collection===entity?.collection&&r.id===entity.id);if(!row)return false;selected=entity;canvasStage?.focus(entity);if(camera){cameraTransition=null;const endTarget=new THREE.Vector3(row.x,row.height/2,row.z),endPosition=new THREE.Vector3(row.x+60,row.height+60,row.z+60);if(animate&&!preferences.get().reducedMotion)cameraTransition={start:performance.now(),position:camera.position.clone(),target:controls.target.clone(),endPosition,endTarget};else{controls.target.copy(endTarget);camera.position.copy(endPosition);controls.update();}}rebuild();return true;},
    resetCamera(){cameraTransition=null;if(canvasStage&&projection)canvasStage.setCamera(fitCanvasCamera(fitRows?{a:fitRows,b:fitRows}:projection,views.clientWidth,views.clientHeight,mode));fit();draw();},
    getCamera(){return canvasStage?.getCamera()||{position:camera?.position.toArray()??null,target:controls?.target.toArray()??null};},
    getStats(){const arms=['split','difference'].includes(mode)?[0,1]:[mode==='plan'?1:0];const segment=width/arms.length;const targets=camera?meshes.filter(m=>!m.userData.ghost&&arms.includes(m.parent===scenes[0]?0:1)).map(m=>{const arm=m.parent===scenes[0]?0:1;const v=m.position.clone().project(camera);return {...m.userData,x:(arms.indexOf(arm)+(v.x+1)/2)*segment,y:(1-v.y)/2*height};}):[];return {...canvasStage?.getStats(),targets,camera:api.getCamera(),mode,disposed,backend:disposed?'disposed':canvasStage?'canvas2d':renderer&&!error?renderBackend:'inventory-fallback',backendReason,objects:canvasStage?canvasStage.getStats().objects:meshes.length,geometries:renderer?.info?.memory?.geometries??null,textures:renderer?.info?.memory?.textures??null,month:projection?.month??null,layoutVersion:mapping.version,error};},
    dispose(){if(disposed)return;disposed=true;unsubscribeMotion();preferences.dispose();observer?.disconnect();globalThis.removeEventListener?.('resize',resize);canvasStage?.dispose();effects?.dispose();if(animation)cancelAnimationFrame(animation);views.removeEventListener('click',pick);renderer?.domElement.removeEventListener('webglcontextlost',lost);controls?.dispose();releaseMeshes();for(const scene of scenes)scene.traverse(object=>{if(object.geometry){object.geometry.dispose();if(Array.isArray(object.material))object.material.forEach(material=>material.dispose());else object.material.dispose();}});effects?.dispose();renderer?.dispose();renderer=null;root.remove();resolveReady({backend:'disposed'});},
  };
  return api;
}
