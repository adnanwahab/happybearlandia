import * as THREE from 'three';
import { createTrafficVehicleMetadata } from '../../vehicle-inspector.js';
import { generateRoadNetwork } from '../geometry/road-network.js';
import { toBufferGeometry } from '../geometry/geometry-cache.js';
import { PROP_KITS } from '../geometry/prop-library.js';
import { time, positionLocal, positionWorld, sin, vec3, vec2, dot, fract, mix, materialColor, materialRoughness } from 'three/tsl';
import { MeshStandardNodeMaterial, PointsNodeMaterial } from 'three/webgpu';

export function createCityDetails(scene, town) {
  const root = new THREE.Group(); root.name = 'city-render-details'; scene.add(root);
  const resources = [], groups = {};
  const track = item => (resources.push(item), item);
  const material = (color, roughness=.8) => track(new THREE.MeshStandardMaterial({color,roughness}));
  const box = track(new THREE.BoxGeometry(1,1,1)), dummy = new THREE.Object3D();
  function instances(name, geometry, mat, transforms) {
    const mesh = new THREE.InstancedMesh(geometry,mat,transforms.length);
    transforms.forEach((t,i)=>{dummy.position.set(...t.p);dummy.scale.set(...t.s);dummy.rotation.set(0,t.r||0,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(t.c)mesh.setColorAt(i,new THREE.Color(t.c));});
    mesh.userData.transforms=transforms;
    mesh.computeBoundingSphere(); mesh.receiveShadow = true; root.add(mesh); (groups[name] ||= []).push(mesh); return mesh;
  }
  const roadMaterial = track(new MeshStandardNodeMaterial({color:0x353a3c,roughness:.94}));
  const grain=fract(sin(dot(positionWorld.xz.mul(19),vec2(12.9898,78.233))).mul(43758.5453));
  roadMaterial.colorNode=materialColor.mul(mix(.87,1,grain));roadMaterial.roughnessNode=materialRoughness.mul(mix(.86,1,grain));
  const roads = [], markings = [], curbs = [], routes = [];
  for(const road of town.roads) for(let i=1;i<road.pts.length;i++) {
    const a=road.pts[i-1], b=road.pts[i], dx=b[0]-a[0], dz=b[1]-a[1], length=Math.hypot(dx,dz);
    if(length<1)continue;
    const r=Math.atan2(dx,dz), nx=dz/length, nz=-dx/length;
    roads.push({p:[(a[0]+b[0])/2,.12,(a[1]+b[1])/2],s:[9,.2,length],r});
    for(const sign of [-1,1])curbs.push({p:[(a[0]+b[0])/2+nx*5*sign,.28,(a[1]+b[1])/2+nz*5*sign],s:[.45,.45,length],r});
    for(let d=4;d<length-3;d+=9)markings.push({p:[a[0]+dx*d/length,.235,a[1]+dz*d/length],s:[.15,.015,3],r});
    routes.push({a,b,dx,dz,length,r,nx,nz});
  }
  const networkData=generateRoadNetwork(town.roads);
  for(const junction of networkData.metadata.intersections)for(const axis of [0,1])for(const side of [-1,1])for(let stripe=-3;stripe<=3;stripe++)markings.push({p:axis?[junction.x+side*(junction.radius-1.3),.045,junction.z+stripe*.9]:[junction.x+stripe*.9,.045,junction.z+side*(junction.radius-1.3)],s:axis?[1.8,.015,.4]:[.4,.015,1.8]});
  const network=track(toBufferGeometry(networkData));
  const roadMesh=new THREE.Mesh(network,[roadMaterial,material(0x77786f)]);roadMesh.receiveShadow=true;root.add(roadMesh);groups.roads=[roadMesh];
  instances('roads',box,material(0xbebcac),markings);
  const treePositions=[], trunks=[], roofs=[];
  let treeIndex=0;
  const inside=(x,z,poly)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>z)!==(poly[j][1]>z)&&x<(poly[j][0]-poly[i][0])*(z-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])hit=!hit;return hit;};
  function tree(x,z,size=1){
    const seed=treeIndex++,height=(5.5+seed%4)*size;
    trunks.push({p:[x,height*.37,z],s:[.32*size,height*.74,.32*size],seed});
    for(let lobe=0;lobe<3;lobe++){const angle=lobe*2.094+seed;
      treePositions.push({p:[x+Math.cos(angle)*size*.9,height*(.7+lobe*.08),z+Math.sin(angle)*size*.9],s:[(1.8+seed%3*.35)*size,(2.2+lobe*.3)*size,(1.8+seed%3*.35)*size],r:seed*.7,c:[0x304c29,0x3e592d,0x4c6536,0x284830,0x53643b][(seed+lobe)%5],seed});
    }
  }
  for(const b of town.buildings) {
    if(b.kind==='park'){
      const xs=b.poly.map(p=>p[0]),zs=b.poly.map(p=>p[1]),x0=Math.min(...xs),z0=Math.min(...zs),w=Math.max(...xs)-x0,d=Math.max(...zs)-z0;
      const count=Math.min(90,Math.max(10,Math.floor(w*d/85)));
      for(let i=0;i<count;i++){const x=x0+3+((i*.61803398875)%1)*Math.max(1,w-6),z=z0+3+((i*.41421356237+.2)%1)*Math.max(1,d-6);if(inside(x,z,b.poly))tree(x,z,.85+(i%4)*.1);}
    }
    else if(b.height>6)roofs.push({p:[b.center[0],b.height+.8,b.center[1]],s:[2.5,1.6,2]});
  }
  for(const route of routes)for(let d=20;d<route.length;d+=38){const t=d/route.length;for(const sign of [-1,1])tree(route.a[0]+route.dx*t+route.nx*8*sign,route.a[1]+route.dz*t+route.nz*8*sign,.7);}
  instances('vegetation',box,material(0x6c5741),trunks);
  const wind = new MeshStandardNodeMaterial({color:0xffffff,roughness:.95}); track(wind);
  wind.positionNode=positionLocal.add(vec3(sin(time.mul(.8).add(positionLocal.y)).mul(positionLocal.y.max(0)).mul(.025),0,0));
  instances('vegetation',track(new THREE.IcosahedronGeometry(1,1)),wind,treePositions);
  instances('roofs',box,material(0x8b9398),roofs);
  const propTransforms={metal:[],dark:[],wood:[],red:[],lamp:[],solar:[],sign:[]};
  function kit(name,x,y,z,r=0){for(const part of PROP_KITS[name]){const [px,py,pz]=part.position;propTransforms[part.material].push({p:[x+px*Math.cos(r)+pz*Math.sin(r),y+py,z-px*Math.sin(r)+pz*Math.cos(r)],s:part.scale,r});}}
  for(const [i,b] of town.buildings.entries())if(b.kind==='park'){kit('bench',b.center[0]+7,0,b.center[1]);kit('bin',b.center[0]+9,0,b.center[1]);}else if(b.height>8){kit(['hvac','vent','solar','antenna','water-tank'][i%5],b.center[0]+2,b.height,b.center[1]+2);}
  for(const [i,route] of routes.entries())for(let d=14;d<route.length;d+=55){const x=route.a[0]+route.dx*d/route.length+route.nx*6,z=route.a[1]+route.dz*d/route.length+route.nz*6;kit('streetlight',x,0,z,route.r);if(i%3===0)kit('sign',x+2,0,z);}
  const propColors={metal:0x778084,dark:0x333c40,wood:0x927352,red:0xb65d43,lamp:0xffdd9b,solar:0x33526d,sign:0x386b59};
  for(const [family,transforms] of Object.entries(propTransforms)){const mat=material(propColors[family]);if(family==='lamp'){mat.emissive.setHex(0xffd38b);mat.emissiveIntensity=.8;}instances('props',box,mat,transforms);}
  const carTransforms=Array.from({length:Math.min(600,routes.length*8)},(_,i)=>({p:[0,-20,0],s:[1.8,.65,3.8],c:[0xc8d0d5,0x364d60,0xb65e43,0xd4be87,0x55585c][i%5]}));
  const cars=instances('traffic',box,material(0xffffff,.34),carTransforms);
  const cabins=instances('traffic',box,material(0x263b45,.25),carTransforms.map(t=>({...t,s:[1.45,.58,1.9],c:null})));
  const wheelGeometry=track(new THREE.CylinderGeometry(.32,.32,.2,8));wheelGeometry.rotateZ(Math.PI/2);
  const wheels=instances('traffic',wheelGeometry,material(0x202322),Array.from({length:carTransforms.length*4},()=>({p:[0,-20,0],s:[1,1,1]})));
  const vehicleMetadata = carTransforms.map((transform, instanceId) => createTrafficVehicleMetadata(instanceId, { color: transform.c, routeIndex: instanceId % Math.max(1, routes.length) }));
  cars.userData.pickKind = 'vehicle';
  cars.userData.vehicleMetadata = vehicleMetadata;
  const vehicleMatrix = new THREE.Matrix4();
  function getVehicle(id) {
    const index = Number.isInteger(id) ? id : vehicleMetadata.findIndex(vehicle => vehicle.id === id);
    if (index < 0 || index >= vehicleMetadata.length) return null;
    cars.updateWorldMatrix(true, false); cars.getMatrixAt(index, vehicleMatrix); vehicleMatrix.premultiply(cars.matrixWorld);
    const elements = vehicleMatrix.elements;
    return { ...vehicleMetadata[index], position: { x: elements[12], y: elements[13], z: elements[14] }, heading: Math.atan2(elements[8], elements[10]), active: cars.visible && root.visible && index < cars.count };
  }
  function pickVehicle(raycaster) {
    if (!cars.visible || !root.visible || cars.count < 1 || typeof raycaster?.intersectObject !== 'function') return null;
    cars.updateWorldMatrix(true, false);
    const hit = raycaster.intersectObject(cars, false).find(hit => Number.isInteger(hit.instanceId) && hit.instanceId >= 0 && hit.instanceId < cars.count);
    if (!hit) return null;
    return { ...getVehicle(hit.instanceId), distance: hit.distance, point: { x: hit.point.x, y: hit.point.y, z: hit.point.z }, object: cars };
  }
  const rainCount=3000, positions=new Float32Array(rainCount*3);
  for(let i=0;i<rainCount;i++){positions[i*3]=Math.sin(i*127.1)*120;positions[i*3+1]=(i*13.7)%100;positions[i*3+2]=Math.cos(i*311.7)*120;}
  const rainGeometry=track(new THREE.BufferGeometry());rainGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const rainMat=track(new PointsNodeMaterial({color:0xb8cfdf,size:.12,transparent:true,opacity:.45,depthWrite:false}));
  rainMat.positionNode=vec3(positionLocal.x,positionLocal.y.sub(time.mul(35)).mod(100),positionLocal.z);
  const rain=new THREE.Points(rainGeometry,rainMat);rain.frustumCulled=false;root.add(rain);groups.rain=[rain];
  let wetness=0, weather='clear', trafficDensity=1,lastStatic=-Infinity;
  return {
    groups, pickVehicle, getVehicle,
    get vehicleCount() { return cars.count; },
    setWeather(value){if(!['clear','cloudy','rain'].includes(value))throw new RangeError('Weather must be clear, cloudy, or rain');weather=value;},
    update(now,dt,camera,settings,features,state={}) {
      wetness += ((weather==='rain'?1:0)-wetness)*Math.min(1,dt*.4);
      roadMaterial.roughness=.94-wetness*.67;roadMaterial.color.set(0x353a3c).multiplyScalar(1-wetness*.3);
      for(const [name,meshes] of Object.entries(groups))for(const m of meshes)m.visible=features[name]!==false;
      rain.visible=features.rain!==false&&wetness>.05;rain.position.set(camera.position.x,0,camera.position.z);
      rain.geometry.setDrawRange(0,Math.floor(rainCount*wetness*settings.density));
      trafficDensity=Number.isFinite(state.trafficDensity)?THREE.MathUtils.clamp(state.trafficDensity,0,1):trafficDensity;
      cars.count=routes.length?Math.floor(carTransforms.length*settings.density*trafficDensity):0;
      for(let i=0;i<cars.count;i++) {
        const route=routes[i%routes.length], sign=i%2?1:-1;
        // Decorative visual speed in world meters/second, independent of road
        // length. Route-proportional speed made long-road cars too fast to click.
        const phase=((now*.001*(6+i%5)/route.length+i*.137)%1);
        const t=sign>0?phase:1-phase;
        const x=route.a[0]+route.dx*t+route.nx*2*sign,z=route.a[1]+route.dz*t+route.nz*2*sign,heading=route.r+(sign<0?Math.PI:0);
        dummy.position.set(x,.7,z);dummy.scale.set(1.8,.65,3.8);dummy.rotation.set(0,heading,0);dummy.updateMatrix();cars.setMatrixAt(i,dummy.matrix);
        dummy.position.set(x,1.27,z);dummy.scale.set(1.45,.58,1.9);dummy.updateMatrix();cabins.setMatrixAt(i,dummy.matrix);
        let wheel=0;for(const side of [-1,1])for(const end of [-1,1]){const lateral=side*.86,longitudinal=end*1.15;dummy.position.set(x+Math.cos(heading)*lateral+Math.sin(heading)*longitudinal,.35,z-Math.sin(heading)*lateral+Math.cos(heading)*longitudinal);dummy.scale.set(1,1,1);dummy.updateMatrix();wheels.setMatrixAt(i*4+wheel++,dummy.matrix);}
      }
      cars.instanceMatrix.needsUpdate=true;cars.computeBoundingSphere();
      cabins.count=cars.count;wheels.count=cars.count*4;for(const mesh of [cabins,wheels]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
      if(now-lastStatic>250){lastStatic=now;
        for(const name of ['vegetation','roofs','props'])for(const mesh of groups[name]||[]){
          if(!mesh.isInstancedMesh)continue;const radius=(name==='vegetation'?650:name==='props'?260:300)*(settings.geometryRadius||1);let count=0;
          for(const [i,t] of mesh.userData.transforms.entries()){
            if(((t.seed??i)*.61803398875)%1>settings.density||Math.hypot(t.p[0]-camera.position.x,t.p[2]-camera.position.z)>radius)continue;
            dummy.position.set(...t.p);dummy.scale.set(...t.s);dummy.rotation.set(0,t.r||0,0);dummy.updateMatrix();mesh.setMatrixAt(count,dummy.matrix);if(t.c)mesh.setColorAt(count,new THREE.Color(t.c));count++;
          }
          mesh.castShadow=name==='vegetation'&&settings.shadows&&features.shadows;
          mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();
        }
      }
    },
    dispose(){scene.remove(root);for(const r of resources)r.dispose();for(const meshes of Object.values(groups))for(const mesh of meshes)mesh.dispose?.();rain.geometry.dispose();rain.material.dispose();}
  };
}
