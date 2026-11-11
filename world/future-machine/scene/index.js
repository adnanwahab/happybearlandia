import {createSpatialMapping} from './mapping.js';

/** Synchronous host API; renderer loading is deferred so fallback remains usable. */
export function createStage(container, {onSelect} = {}) {
  const doc = container.ownerDocument;
  const root = doc.createElement('section');
  root.setAttribute('aria-label', 'Synchronized City comparison');
  root.style.cssText = 'position:relative;min-height:300px;background:#10232d;color:#eef6fb;border-radius:12px;overflow:hidden';
  const legend = doc.createElement('p'), status = doc.createElement('p'), views = doc.createElement('div'), list = doc.createElement('div');
  legend.style.cssText = status.style.cssText = 'margin:8px 12px;font:12px/1.5 system-ui';
  views.style.cssText = 'position:relative;height:clamp(280px,48vw,560px);touch-action:none';
  list.style.cssText='display:flex;gap:12px;max-height:180px;overflow:auto;padding:8px 12px';
  root.append(legend,status,views,list); container.append(root);
  const mapping = createSpatialMapping();
  let disposed=false, mode='split', ghosts=true, projection=null, renderer=null, THREE, controls, camera, scenes=[], meshes=[], selected=null, error=null;
  let width=1,height=1;
  const resize=()=>{ width=Math.max(1,views.clientWidth);height=Math.max(1,views.clientHeight);renderer?.setSize(width,height,false);draw(); };
  const observer=globalThis.ResizeObserver ? new ResizeObserver(resize) : null;
  observer?.observe(views);globalThis.addEventListener?.('resize',resize);
  function releaseMeshes() {
    for(const mesh of meshes) {mesh.parent?.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}
    meshes=[];
  }
  function material(row, ghost) {
    const focused=selected?.id===row.id&&selected?.collection===row.collection;
    return new THREE.MeshStandardMaterial({color:focused?0xffcf62:row.collection==='projects'?0xd5ab67:ghost?0x89e7ef:0x80afba,transparent:ghost,opacity:ghost?.25:1,wireframe:ghost,roughness:.85});
  }
  function add(row,scene,arm,ghost=false) {
    let geometry;
    if(row.polygon) {
      const shape=new THREE.Shape();row.polygon.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
      geometry=new THREE.ExtrudeGeometry(shape,{depth:row.height,bevelEnabled:false});geometry.rotateX(-Math.PI/2);
    } else geometry=new THREE.BoxGeometry(14,row.height,14);
    const mesh=new THREE.Mesh(geometry,material(row,ghost));
    if(!row.polygon)mesh.position.set(row.x,row.height/2,row.z);
    mesh.userData={collection:row.collection,id:row.id,arm,ghost};scene.add(mesh);meshes.push(mesh);
    // Progress is a recorded ratio, presented as an explicit bar rather than invented floors.
  }
  function rebuild() {
    if(!renderer||!projection)return;
    releaseMeshes();
    for(const [side,records] of [projection.a,projection.b].entries()) {
      for(const row of records)add(row,scenes[side],side?'plan':'baseline');
      if(ghosts) {
        const other=side?projection.a:projection.b;
        for(const row of other) if(!records.some(r=>r.collection===row.collection&&r.id===row.id))add(row,scenes[side],side?'plan':'baseline',true);
      }
    }
    draw();
  }
  function draw() {
    if(!renderer||disposed)return;
    renderer.setScissorTest(true);
    const arms=mode==='split'?[0,1]:[mode==='plan'?1:0];
    const segment=width/arms.length;
    camera.aspect=segment/height;camera.updateProjectionMatrix();
    arms.forEach((arm,i)=>{renderer.setViewport(i*segment,0,segment,height);renderer.setScissor(i*segment,0,segment,height);renderer.render(scenes[arm],camera);});
  }
  function summary() {
    list.replaceChildren();
    if(!projection)return;
    for(const [side,records] of [projection.a,projection.b].entries()) {
      const section=doc.createElement('div'), title=doc.createElement('strong');title.textContent=side?'Future B · Plan':'Future A · Baseline';section.append(title);
      section.hidden=mode!=='split'&&mode!==(side?'plan':'baseline');
      for(const row of records) {
        const button=doc.createElement('button');button.type='button';button.style.cssText='display:block;margin:4px 0;font:12px system-ui';
        button.textContent=`${row.id} · ${row.mapping === 'synthetic-layout'?'schematic':'OSM footprint'}${row.progress===undefined?'':` · recorded progress ${Math.round(row.progress*100)}%`}`;
        button.onclick=()=>onSelect?.({collection:row.collection,id:row.id,arm:side?'plan':'baseline'});section.append(button);
      }
      list.append(section);
    }
  }
  function fit() {
    if(!camera||!projection)return;
    const rows=[...projection.a,...projection.b];if(!rows.length)return;
    const xs=rows.flatMap(r=>r.polygon?r.polygon.map(p=>p[0]):[r.x-8,r.x+8]),zs=rows.flatMap(r=>r.polygon?r.polygon.map(p=>p[1]):[r.z-8,r.z+8]);
    const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2,r=Math.max(60,Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs));
    controls.target.set(x,0,z);camera.position.set(x+r,r,z+r);controls.update();draw();
  }
  function pick(event) {
    if(!renderer||!projection)return;
    const box=views.getBoundingClientRect(),x=event.clientX-box.left,y=event.clientY-box.top;
    const arm=mode==='split'?(x<width/2?0:1):(mode==='plan'?1:0),segment=mode==='split'?width/2:width;
    const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(((x%segment)/segment)*2-1,1-y/height*2),camera);
    const hit=ray.intersectObjects(meshes.filter(m=>m.parent===scenes[arm]&&!m.userData.ghost))[0];
    if(hit)onSelect?.({...hit.object.userData,ghost:undefined});
  }
  views.addEventListener('click',pick);
  // Native ESM uses the host's same-version curated Three import map.
  Promise.all([import('three'),import('three/addons/controls/OrbitControls.js')]).then(([module,{OrbitControls}])=>{
    if(disposed)return;THREE=module;
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));
    views.append(renderer.domElement);renderer.domElement.style.cssText='display:block;width:100%;height:100%';renderer.domElement.setAttribute('aria-label','City inventory scenes; drag to orbit, scroll to zoom');
    scenes=[0,1].map(()=>{const scene=new THREE.Scene();scene.background=new THREE.Color(0x10232d);scene.add(new THREE.HemisphereLight(0xdfeeff,0x425449,2));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(50,100,60);scene.add(sun);return scene;});
    camera=new THREE.PerspectiveCamera(45,1,.1,100000);camera.position.set(100,100,100);
    controls=new OrbitControls(camera,renderer.domElement);controls.addEventListener('change',draw);controls.enableDamping=false;
    renderer.domElement.addEventListener('webglcontextlost',lost);
    resize();rebuild();fit();status.textContent=projection?.physicalDifference?'Recorded building differences · wireframe ghosts show presence in the other future.':'No recorded physical building difference at this month.';
  }).catch(fail);
  function lost(event) {event.preventDefault();fail(new Error('Graphics context lost'));}
  function fail(reason) {if(disposed)return;error=reason?.message||'Graphics unavailable';status.textContent='3D unavailable. Compare the recorded City inventory below.';views.hidden=true;renderer?.dispose();}
  const api={
    update(frame,diff) {
      if(disposed)return;
      if(!frame?.baseline?.state||!frame?.plan?.state){projection=null;releaseMeshes();list.replaceChildren();legend.textContent='City snapshots unavailable';status.textContent='Both futures are required for a matched scene.';draw();return;}
      const first=!projection;projection=mapping.frame(frame.baseline.state,frame.plan.state);
      legend.textContent=`Month ${frame.month} · ${projection.label}`;
      if(!error)status.textContent=projection.physicalDifference?'Recorded building differences · wireframe ghosts show presence in the other future.':'No recorded physical building difference at this month.';
      summary();rebuild();if(first)fit();
    },
    setMode(value){if(!['split','baseline','plan'].includes(value))throw new TypeError('Unknown scene mode');mode=value;summary();draw();},
    setGhosts(value){ghosts=Boolean(value);rebuild();},
    focus(entity){if(disposed||!projection)return false;const row=[...projection.a,...projection.b].find(r=>r.collection===entity?.collection&&r.id===entity.id);if(!row)return false;selected=entity;if(camera){controls.target.set(row.x,row.height/2,row.z);camera.position.set(row.x+60,row.height+60,row.z+60);controls.update();}rebuild();return true;},
    getStats(){return {backend:renderer&&!error?'webgl':'inventory-fallback',objects:meshes.length,geometries:renderer?.info.memory.geometries??0,textures:renderer?.info.memory.textures??0,month:projection?.month??null,layoutVersion:mapping.version,error};},
    dispose(){if(disposed)return;disposed=true;observer?.disconnect();globalThis.removeEventListener?.('resize',resize);views.removeEventListener('click',pick);renderer?.domElement.removeEventListener('webglcontextlost',lost);controls?.dispose();releaseMeshes();renderer?.dispose();root.remove();},
  };
  return api;
}
