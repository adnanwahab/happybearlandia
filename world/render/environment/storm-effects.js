import * as THREE from 'three';

const MAX_RAIN = 1200;
const LOW_RAIN = 300;

// This layer reads committed parcel outcomes. It never chooses parcels or depths.
// Geometry is triangulated once; one shared water draw avoids per-parcel draw cost.
export function createStormEffects(scene, town) {
  const root = new THREE.Group();
  root.name = 'model-storm-effects';
  scene.add(root);
  const parcelCache = new WeakMap();
  function parcelGeometry(building) {
    // Surface extents belong to the model, including any explicitly modeled lot apron.
    const poly = building.state?.floodSurfacePoly ?? building.poly;
    if (!Array.isArray(poly) || poly.length < 3 || !poly.every(p => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1]))) return null;
    const key = JSON.stringify(poly);
    const cached = parcelCache.get(building);
    if(cached?.key === key) return cached;
    const contour = poly.map(([x,z]) => new THREE.Vector2(x,z));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    const vertices=[];
    for(const face of faces) for(const index of face) vertices.push(poly[index][0],0,poly[index][1]);
    const entry={key,vertices};
    parcelCache.set(building,entry);
    return entry;
  }
  const waterGeometry = new THREE.BufferGeometry();
  let waterPosition = new THREE.Float32BufferAttribute(new Float32Array(3),3);
  waterPosition.setUsage(THREE.DynamicDrawUsage);
  waterGeometry.setAttribute('position',waterPosition);
  waterGeometry.setDrawRange(0,0);
  let waterSignature = '';
  const waterMaterial = new THREE.MeshBasicMaterial({color:0x3d9cba,transparent:true,opacity:.62,side:THREE.DoubleSide,depthWrite:false});
  const water = new THREE.Mesh(waterGeometry,waterMaterial);
  water.name = 'flooded-parcel-water';
  // Invisible source triangles are packed out, so no degenerate or fake water remains.
  water.frustumCulled = false;
  water.renderOrder = 2;
  root.add(water);

  const rainGeometry = new THREE.BufferGeometry();
  const rainPosition = new THREE.Float32BufferAttribute(new Float32Array(MAX_RAIN*6),3);
  rainPosition.setUsage(THREE.DynamicDrawUsage);
  rainGeometry.setAttribute('position',rainPosition);
  rainGeometry.setDrawRange(0,0);
  const rainMaterial = new THREE.LineBasicMaterial({color:0xb6d0e2,transparent:true,opacity:.5,depthWrite:false});
  const rain = new THREE.LineSegments(rainGeometry,rainMaterial);
  rain.name = 'storm-rain';
  rain.frustumCulled = false;
  root.add(rain);
  let state={floodedParcelIds:[],depths:[],rainCount:0,reducedMotion:false,waterDrawCalls:0};
  let disposed = false;

  return {
    update({minute=0,intensity=0,reducedMotion=false,rainEnabled=true,low=false,enabled=true}={}, camera) {
      if (disposed) return;
      const ids=[],depths=[];
      let target=0;
      const active=[],signature=[];
      for (const building of town.buildings) {
        const depth=building.state?.floodDepthMeters;
        if (!enabled || !building.state?.flooded || !Number.isFinite(depth) || depth<=0) continue;
        const geometry=parcelGeometry(building);
        if(!geometry?.vertices.length) continue;
        ids.push(building.id);depths.push({id:building.id,depthMeters:depth});
        active.push({geometry,depth});
        target+=geometry.vertices.length/3;
        signature.push([building.id,depth,geometry.key]);
      }
      const nextSignature=JSON.stringify(signature);
      if(nextSignature!==waterSignature) {
        if(waterPosition.count<target) {
          // Replaced buffer size can grow after restoring geometry or starting another storm.
          waterGeometry.dispose();
          waterPosition=new THREE.Float32BufferAttribute(new Float32Array(target*3),3);
          waterPosition.setUsage(THREE.DynamicDrawUsage);
          waterGeometry.setAttribute('position',waterPosition);
        }
        let vertex=0;
        for(const {geometry,depth} of active) for(let i=0;i<geometry.vertices.length;i+=3) {
          waterPosition.setXYZ(vertex++,geometry.vertices[i],depth,geometry.vertices[i+2]);
        }
        waterGeometry.setDrawRange(0,target);
        waterPosition.needsUpdate=true;
        waterSignature=nextSignature;
      }
      water.visible=target>0;
      const strength=Number.isFinite(intensity)?THREE.MathUtils.clamp(intensity,0,1):0;
      const rainCount=reducedMotion || !rainEnabled ? 0 : Math.floor((low?LOW_RAIN:MAX_RAIN)*strength);
      rain.visible=rainCount>0;
      rainGeometry.setDrawRange(0,rainCount*2);
      if(rainCount) {
        // Phase is presentation only, evaluated at the supplied simulation minute.
        // Pausing freezes rain. Stable arithmetic avoids consuming the model RNG.
        const phase=Number.isFinite(minute)?minute:0;
        const cx=camera?.position?.x??0,cz=camera?.position?.z??0;
        const cy=Math.max(0,camera?.position?.y??0);
        for(let i=0;i<rainCount;i++) {
          const x=cx+Math.sin(i*127.1)*110;
          const z=cz+Math.cos(i*311.7)*110;
          const y=cy+((i*13.7-phase*43)%100+100)%100-25;
          rainPosition.setXYZ(i*2,x,y,z);
          rainPosition.setXYZ(i*2+1,x-.65,y-3.2,z-.25);
        }
        rainPosition.needsUpdate=true;
      }
      state={floodedParcelIds:ids,depths,rainCount,reducedMotion:Boolean(reducedMotion),waterDrawCalls:target?1:0};
      water.userData.floodedParcelIds=ids;
    },
    getState(){return structuredClone(state);},
    dispose(){if(disposed)return;disposed=true;scene.remove(root);waterGeometry.dispose();waterMaterial.dispose();rainGeometry.dispose();rainMaterial.dispose();},
  };
}
