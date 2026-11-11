import {createCanvasStage,fitCanvasCamera} from './canvas-stage.js';
import {createVisualEffects} from './effects.js';
import {createSpatialMapping} from './mapping.js';

/** Synchronous host API; renderer loading is deferred so fallback remains usable. */
export function createStage(container, {onSelect,history} = {}) {
  const doc = container.ownerDocument;
  const root = doc.createElement('section');
  root.setAttribute('aria-label', 'Synchronized City comparison');
  root.style.cssText = 'position:relative;min-height:300px;background:#10232d;color:#eef6fb;border-radius:12px;overflow:hidden';
  const legend = doc.createElement('p'), status = doc.createElement('p'), views = doc.createElement('div'), list = doc.createElement('div');
  legend.style.cssText = status.style.cssText = 'margin:8px 12px;font:12px/1.5 system-ui';
  views.style.cssText = 'position:relative;height:clamp(280px,32vw,400px);touch-action:none';
  list.style.cssText='display:flex;gap:12px;max-height:180px;overflow:auto;padding:8px 12px';
  const labels=doc.createElement('div');labels.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';views.append(labels);root.append(legend,status,views,list); container.append(root);
  const mapping = createSpatialMapping();
  let fitRows=null;
  if(history){const all=new Map();for(let month=0;month<=120;month++){const a=history.baseline[month]?.state,b=history.plan[month]?.state;if(a&&b){const projection=mapping.frame(a,b);for(const row of [...projection.a,...projection.b])all.set(`${row.collection}:${row.id}`,row);}}fitRows=[...all.values()];}
  let disposed=false, mode='split', ghosts=true, projection=null, renderer=null, THREE, controls, camera, scenes=[], meshes=[], selected=null, error=null;
  let currentFrame=null;let width=1,height=1, canvasStage=null, effects=null, currentDiff=null, animation=null;
  const changedKeys=()=>new Set((currentDiff?.entities||[]).filter(e=>e.physical||e.collection==='projects').map(e=>`${e.collection}:${e.id}`));
  const changed=row=>changedKeys().has(`${row.collection}:${row.id}`);
  const resize=()=>{ width=Math.max(1,views.clientWidth);height=Math.max(1,views.clientHeight);renderer?.setSize(width,height,false);draw(); };
  const observer=globalThis.ResizeObserver ? new ResizeObserver(resize) : null;
  observer?.observe(views);globalThis.addEventListener?.('resize',resize);
  function releaseMeshes() {
    effects?.dispose();effects=THREE&&!canvasStage?createVisualEffects({THREE,reducedMotion:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches}):null;
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
    // Progress is a recorded ratio, presented as an explicit bar rather than invented floors.
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
    if(!renderer||disposed)return;
    renderer.setScissorTest(true);
    const arms=['split','difference'].includes(mode)?[0,1]:[mode==='plan'?1:0];
    const segment=width/arms.length;
    camera.aspect=segment/height;camera.updateProjectionMatrix();
    arms.forEach((arm,i)=>{renderer.setViewport(i*segment,0,segment,height);renderer.setScissor(i*segment,0,segment,height);renderer.render(scenes[arm],camera);});
    labels.replaceChildren();
    arms.forEach((arm,i)=>{const records=arm?projection?.b:projection?.a;if(!records)return;for(const row of records){if(mode==='difference'&&!changed(row))continue;const count=(arm?currentFrame?.plan:currentFrame?.baseline)?.state?.units?.filter(u=>u.buildingId===row.id).length;const isChanged=changed(row);if(!count&&!isChanged)continue;const point=new THREE.Vector3(row.x,row.height+8,row.z).project(camera);const x=(i+(point.x+1)/2)*segment,y=(1-point.y)/2*height;if(x<i*segment||x>(i+1)*segment||y<0||y>height)continue;const label=doc.createElement('span');label.textContent=count?`${count} homes${isChanged?' · added':''}`:`Project · ${Math.round((row.progress||0)*100)}%`;label.style.cssText=`position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-100%);font:${isChanged?'700 13':'11'}px system-ui;color:${isChanged?'#dcffbd':'#adc9d5'};background:#0a1a24d9;padding:5px 8px;border-radius:5px;white-space:nowrap`;labels.append(label);}});
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
        button.textContent=`${row.id} · ${row.mapping === 'synthetic-layout'?'schematic':'OSM footprint'}${row.progress===undefined?'':` · recorded progress ${Math.round(row.progress*100)}%`}`;
        button.onclick=()=>onSelect?.({collection:row.collection,id:row.id,arm:side?'plan':'baseline'});section.append(button);
      }
      list.append(section);
    }
  }
  function fit() {
    if(!camera||!projection)return;
    const rows=fitRows||[...projection.a,...projection.b];if(!rows.length)return;
    const xs=rows.flatMap(r=>r.polygon?r.polygon.map(p=>p[0]):[r.x-8,r.x+8]),zs=rows.flatMap(r=>r.polygon?r.polygon.map(p=>p[1]):[r.z-8,r.z+8]);
    const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2,r=Math.max(60,Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs))*1.25;
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
  Promise.all([import('three'),import('three/addons/controls/OrbitControls.js')]).then(([module,{OrbitControls}])=>{
    if(disposed||canvasStage)return;THREE=module;
    if(new URLSearchParams(location.search).get('renderer')&&['canvas','canvas2d'].includes(new URLSearchParams(location.search).get('renderer'))){fail(new Error('Canvas2D selected'));return;}
    effects=createVisualEffects({THREE,reducedMotion:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches});
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));
    views.append(renderer.domElement);renderer.domElement.style.cssText='display:block;width:100%;height:100%';renderer.domElement.setAttribute('aria-label','City inventory scenes; drag to orbit, scroll to zoom');
    scenes=[0,1].map(()=>{const scene=new THREE.Scene();scene.background=new THREE.Color(0x10232d);scene.add(new THREE.HemisphereLight(0xdfeeff,0x425449,2));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(50,100,60);scene.add(sun);const grid=new THREE.GridHelper(600,25,0x456070,0x203746);grid.position.y=-.1;scene.add(grid);return scene;});
    camera=new THREE.PerspectiveCamera(45,1,.1,100000);camera.position.set(100,100,100);
    controls=new OrbitControls(camera,renderer.domElement);controls.addEventListener('change',draw);controls.enableDamping=false;
    renderer.domElement.addEventListener('webglcontextlost',lost);
    resize();rebuild();fit();
    const animate=now=>{if(disposed||canvasStage)return;if(effects?.tick(now))draw();animation=requestAnimationFrame(animate);};animation=requestAnimationFrame(animate);
    status.textContent=projection?.physicalDifference?'Recorded building differences · wireframe ghosts show presence in the other future.':'No recorded physical building difference at this month.';
  }).catch(fail);
  function lost(event) {event.preventDefault();fail(new Error('Graphics context lost'));}
  function fail(reason) {if(disposed||canvasStage)return;error=reason?.message||'Graphics unavailable';status.textContent='Canvas2D low-fidelity view · same recorded City inventory, camera and timeline.';controls?.dispose();effects?.dispose();if(animation)cancelAnimationFrame(animation);releaseMeshes();renderer?.dispose();renderer?.domElement.remove();renderer=null;canvasStage=createCanvasStage(views,{onSelect});canvasStage.setMode(mode);canvasStage.setGhosts(ghosts);if(projection){canvasStage.update(projection,currentDiff);if(fitRows)canvasStage.setCamera(fitCanvasCamera({a:fitRows,b:fitRows},views.clientWidth,views.clientHeight,mode));}}
  const api={
    update(frame,diff) {
      if(disposed)return;
      if(!frame?.baseline?.state||!frame?.plan?.state){projection=null;releaseMeshes();list.replaceChildren();legend.textContent='City snapshots unavailable';status.textContent='Both futures are required for a matched scene.';draw();return;}
      currentFrame=frame;currentDiff=diff;const first=!projection;projection=mapping.frame(frame.baseline.state,frame.plan.state);
      legend.textContent=`Month ${frame.month} · ${projection.label}`;
      if(!error)status.textContent=projection.physicalDifference?'Recorded building differences · wireframe ghosts show presence in the other future.':'No recorded physical building difference at this month.';
      summary();canvasStage?.update(projection,diff);if(first&&canvasStage&&fitRows)canvasStage.setCamera(fitCanvasCamera({a:fitRows,b:fitRows},views.clientWidth,views.clientHeight,mode));rebuild();if(first)fit();
    },
    setMode(value){if(!['split','baseline','plan','difference'].includes(value))throw new TypeError('Unknown scene mode');mode=value;canvasStage?.setMode(value);summary();rebuild();draw();},
    setGhosts(value){ghosts=Boolean(value);canvasStage?.setGhosts(ghosts);rebuild();},
    focus(entity){if(disposed||!projection)return false;const row=[...projection.a,...projection.b].find(r=>r.collection===entity?.collection&&r.id===entity.id);if(!row)return false;selected=entity;canvasStage?.focus(entity);if(camera){controls.target.set(row.x,row.height/2,row.z);camera.position.set(row.x+60,row.height+60,row.z+60);controls.update();}rebuild();return true;},
    getCamera(){return canvasStage?.getCamera()||{position:camera?.position.toArray()??null,target:controls?.target.toArray()??null};},
    getStats(){const arms=['split','difference'].includes(mode)?[0,1]:[mode==='plan'?1:0];const segment=width/arms.length;const targets=camera?meshes.filter(m=>!m.userData.ghost&&arms.includes(m.parent===scenes[0]?0:1)).map(m=>{const arm=m.parent===scenes[0]?0:1;const v=m.position.clone().project(camera);return {...m.userData,x:(arms.indexOf(arm)+(v.x+1)/2)*segment,y:(1-v.y)/2*height};}):[];return {...canvasStage?.getStats(),targets,camera:api.getCamera(),mode,backend:canvasStage?'canvas2d':renderer&&!error?'webgl':'inventory-fallback',objects:meshes.length,geometries:renderer?.info.memory.geometries??0,textures:renderer?.info.memory.textures??0,month:projection?.month??null,layoutVersion:mapping.version,error};},
    dispose(){if(disposed)return;disposed=true;observer?.disconnect();globalThis.removeEventListener?.('resize',resize);canvasStage?.dispose();effects?.dispose();if(animation)cancelAnimationFrame(animation);views.removeEventListener('click',pick);renderer?.domElement.removeEventListener('webglcontextlost',lost);controls?.dispose();releaseMeshes();renderer?.dispose();root.remove();},
  };
  return api;
}
