import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { positionLocal, positionWorld, cameraPosition, time, instanceIndex, sin, vec3, mix, uniform, smoothstep } from 'three/tsl';
import { GRASS_PRESETS, GRASS_TILE_SIZE, generateGrassTile } from './grass-distribution.js';

export function createGrass(scene,town) {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.006,0,0,.006,0,0,-.005,.35,.004,.005,.35,.004,.01,.72,.014,.016,.72,.014,.03,1,.025],3));
  geometry.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6]);geometry.computeVertexNormals();
  const fadeStart=uniform(30),fadeEnd=uniform(46);
  const material=new MeshStandardNodeMaterial({color:0xffffff,roughness:1,side:THREE.DoubleSide,alphaTest:.08});
  const bend=sin(time.mul(1.7).add(instanceIndex.toFloat().mul(.71))).mul(.035).mul(positionLocal.y.pow(2));
  material.positionNode=positionLocal.add(vec3(bend,0,bend.mul(.45)));
  material.colorNode=mix(vec3(.055,.105,.022),vec3(.21,.29,.075),positionLocal.y);
  material.emissiveNode=vec3(.009,.016,.003).mul(positionLocal.y);
  // Opaque alpha-tested dithering fades out without transparent sorting/overdraw.
  material.opacityNode=smoothstep(fadeStart,fadeEnd,positionWorld.distance(cameraPosition)).oneMinus().mul(smoothstep(30,42,cameraPosition.y).oneMinus());
  material.alphaHash=true;
  const capacity=GRASS_PRESETS.ULTRA.maxBlades,mesh=new THREE.InstancedMesh(geometry,material,capacity);
  mesh.name='near-camera-grass';mesh.count=0;mesh.visible=false;mesh.castShadow=false;mesh.receiveShadow=true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;scene.add(mesh);
  const parks=town.buildings.filter(b=>b.kind==='park'&&b.poly?.length>=3),segments=[];
  for(const road of town.roads)for(let i=1;i<road.pts.length;i++)segments.push({a:road.pts[i-1],b:road.pts[i],clearance:(road.width||9)/2+2.2});
  const tiles=new Map(),dummy=new THREE.Object3D(),color=new THREE.Color(),direction=new THREE.Vector3();
  let lastKey='',lastRefresh=-Infinity,visibleTiles=0,disposed=false,pending=null;
  function tile(tx,tz){
    const key=`${tx},${tz}`;
    if(tiles.has(key)){const cached=tiles.get(key);tiles.delete(key);tiles.set(key,cached);return cached;}
    const x=tx*GRASS_TILE_SIZE,z=tz*GRASS_TILE_SIZE;
    const candidates=parks.filter(p=>{const xs=p.poly.map(v=>v[0]),zs=p.poly.map(v=>v[1]);return Math.max(...xs)>=x&&Math.min(...xs)<=x+GRASS_TILE_SIZE&&Math.max(...zs)>=z&&Math.min(...zs)<=z+GRASS_TILE_SIZE;});
    const nearby=segments.filter(s=>Math.max(s.a[0],s.b[0])+s.clearance>=x&&Math.min(s.a[0],s.b[0])-s.clearance<=x+GRASS_TILE_SIZE&&Math.max(s.a[1],s.b[1])+s.clearance>=z&&Math.min(s.a[1],s.b[1])-s.clearance<=z+GRASS_TILE_SIZE);
    const data=candidates.length?generateGrassTile(tx,tz,candidates,nearby):[];
    tiles.set(key,data);while(tiles.size>192)tiles.delete(tiles.keys().next().value);return data;
  }
  return {
    mesh,
    update(now,camera,settings,enabled=true,preset='BALANCED'){
      if(disposed)return;
      const config=GRASS_PRESETS[preset]||GRASS_PRESETS.BALANCED;
      // Grass cannot contribute readable pixels from an aerial camera.
      if(!enabled||!parks.length||camera.position.y>42){mesh.visible=false;pending=null;lastKey='';return;}
      camera.getWorldDirection(direction);
      const t=direction.y<-.04?Math.max(0,(camera.position.y-.3)/-direction.y):12;
      const look=Math.min(18,t),x=camera.position.x+direction.x*look,z=camera.position.z+direction.z*look;
      const tx=Math.floor(x/GRASS_TILE_SIZE),tz=Math.floor(z/GRASS_TILE_SIZE),density=Math.max(.1,Math.min(1,settings.density??.65));
      const key=`${tx}:${tz}:${preset}:${density.toFixed(2)}`;
      mesh.visible=true;
      if(key!==lastKey&&now-lastRefresh>=160){
        lastRefresh=now;lastKey=key;
        const radius=config.radius,limit=Math.floor(config.maxBlades*density),range=Math.ceil(radius/GRASS_TILE_SIZE),queue=[];
        for(let a=tx-range;a<=tx+range;a++)for(let b=tz-range;b<=tz+range;b++){const distance=Math.hypot((a+.5)*GRASS_TILE_SIZE-x,(b+.5)*GRASS_TILE_SIZE-z);if(distance<radius)queue.push({a,b,distance});}
        queue.sort((a,b)=>a.distance-b.distance);
        pending={queue,index:0,count:0,limit};visibleTiles=0;mesh.count=0;
        fadeStart.value=radius;fadeEnd.value=radius+12;
      }
      if(!pending)return;
      // Incremental CPU preparation: approach a lawn without a one-frame district
      // generation spike. GPU wind never requires per-blade CPU animation.
      const deadline=performance.now()+2;let processed=0;
      while(pending.index<pending.queue.length&&pending.count<pending.limit&&processed<4&&performance.now()<deadline){
        const cell=pending.queue[pending.index++],blades=tile(cell.a,cell.b);processed++;if(blades.length)visibleTiles++;
        for(const blade of blades){if(pending.count>=pending.limit)break;
          dummy.position.set(blade.x,blade.y,blade.z);dummy.rotation.set(0,blade.rotation,0);dummy.scale.set(blade.width,blade.height,blade.width);dummy.updateMatrix();mesh.setMatrixAt(pending.count,dummy.matrix);
          color.setRGB(.68+blade.tint*.3,.76+blade.tint*.22,.6+blade.tint*.2);mesh.setColorAt(pending.count,color);pending.count++;
        }
      }
      mesh.count=pending.count;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
      if(pending.index>=pending.queue.length||pending.count>=pending.limit)pending=null;
    },
    getStats(){return {blades:mesh.visible?mesh.count:0,triangles:mesh.visible?mesh.count*5:0,tiles:visibleTiles,cachedTiles:tiles.size,cacheLimit:192,preparing:!!pending,drawCalls:mesh.visible&&mesh.count?1:0};},
    dispose(){disposed=true;scene.remove(mesh);mesh.dispose();geometry.dispose();material.dispose();tiles.clear();},
  };
}
