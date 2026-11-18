import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {mountColumns} from './columns.js';
import {mountParticles} from './particles.js';
import {roadFrame} from './columns-demo/frame.js';
export const QUALITY=Object.freeze({high:{particles:18000,stride:1},balanced:{particles:12000,stride:2},low:{particles:6000,stride:4}});
export const AERIAL=Object.freeze({position:[620,650,720],target:[0,0,0]});

/** Authored city context in the fixture's local units. Never observed geometry. */
function context(scene){
 const resources=[],keep=x=>(resources.push(x),x);
 const ground=new THREE.Mesh(keep(new THREE.PlaneGeometry(10000,10000)),keep(new THREE.MeshBasicNodeMaterial({color:0x0d1a23})));ground.rotation.x=-Math.PI/2;ground.position.y=-1;scene.add(ground);
 const geometries=[keep(new THREE.BoxGeometry(1,1,1)),keep(new THREE.PlaneGeometry(1,1))];
 const matrix=new THREE.Matrix4(),color=new THREE.Color();
 const blocks=new THREE.InstancedMesh(geometries[0],keep(new THREE.MeshStandardNodeMaterial({color:0xffffff,roughness:.95,metalness:.05})),16*16*6);keep(blocks);
 const roofs=new THREE.InstancedMesh(geometries[0],keep(new THREE.MeshBasicNodeMaterial({color:0x52616a})),16*16*6);keep(roofs);
 const windows=new THREE.InstancedMesh(geometries[0],keep(new THREE.MeshBasicNodeMaterial({color:0x64716d})),16*16*6);keep(windows);
 const parks=new THREE.InstancedMesh(geometries[1],keep(new THREE.MeshBasicNodeMaterial({color:0x1b3432})),32);keep(parks);let parkCount=0;
 for(let z=0;z<16;z++)for(let x=0;x<16;x++)if((x*7+z*11)%17===0){matrix.makeRotationX(-Math.PI/2);matrix.scale(new THREE.Vector3(64,64,1));matrix.setPosition((x-8)*80+40,.1,(z-8)*80+40);parks.setMatrixAt(parkCount++,matrix);}parks.count=parkCount;scene.add(parks);
 let n=0;
 for(let z=0;z<16;z++)for(let x=0;x<16;x++)for(let j=0;j<6;j++){
  if((x*7+z*11)%17===0)continue;
  const k=(x*31+z*17+j*13)%41,h=12+k*1.2+(j===2&&x%4===1?32:0),w=15+(k%6),d=19+(k%9),px=(x-8)*80+15+(j%3)*24,pz=(z-8)*80+20+Math.floor(j/3)*38;
  matrix.makeScale(w,h,d);matrix.setPosition(px,h/2,pz);blocks.setMatrixAt(n,matrix);color.setHSL(.57,.13,.17+(k%5)*.018);blocks.setColorAt(n,color);
  matrix.makeScale(w+1,.7,d+1);matrix.setPosition(px,h,pz);roofs.setMatrixAt(n,matrix);
  matrix.makeScale(w*.52,.5,.12);matrix.setPosition(px,h*.63,pz+d/2+.1);windows.setMatrixAt(n,matrix);n++;
 }
 for(const mesh of [blocks,roofs,windows])mesh.count=n;scene.add(blocks,roofs,windows);
 const roadPoints=[];for(let i=-8;i<=8;i++){roadPoints.push(-660,.03,i*80,660,.03,i*80,i*80,.03,-660,i*80,.03,660);}
 const roads=new THREE.LineSegments(keep(new THREE.BufferGeometry()),keep(new THREE.LineBasicNodeMaterial({color:0x30444e})));roads.geometry.setAttribute('position',new THREE.Float32BufferAttribute(roadPoints,3));scene.add(roads);
 scene.add(new THREE.HemisphereLight(0xb5d8ef,0x18242c,2));const sun=new THREE.DirectionalLight(0x8db9cd,2);sun.position.set(-600,900,300);scene.add(sun);
 return {bytes:()=>resources.filter(r=>r.isBufferGeometry).reduce((sum,g)=>sum+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(g.index?.array.byteLength??0),0)+[blocks,roofs,windows,parks].reduce((s,m)=>s+m.instanceMatrix.array.byteLength+(m.instanceColor?.array.byteLength??0),0),dispose(){for(const r of resources)r.dispose();scene.clear();}};
}
export async function createXrayScene({renderer,surface,reducedMotion=false,frame=roadFrame(0)}){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x0c1822);scene.fog=new THREE.FogExp2(0x203440,.00055);
 const camera=new THREE.PerspectiveCamera(48,1,2,6000);const controls=new OrbitControls(camera,surface);controls.enableDamping=!reducedMotion;controls.dampingFactor=.1;controls.minDistance=220;controls.maxDistance=2100;controls.minPolarAngle=.2;controls.maxPolarAngle=Math.PI*.43;controls.screenSpacePanning=false;
 const city=context(scene),metricId=frame.metrics[0].id;
 let quality='high',columns,particles,closed=false,seconds=0,playing=!reducedMotion,last=null,savedPose=null,columnsOn=true,particlesOn=true,viewKey='',projectionKey='';
 function aerial(remember=true){if(remember)savedPose={position:camera.position.toArray(),target:controls.target.toArray()};camera.position.fromArray(AERIAL.position);controls.target.fromArray(AERIAL.target);camera.lookAt(controls.target);controls.update();}
 aerial(false);
 function gradeParticles(){const mesh=scene.children.find(node=>node.name==='Synthetic demonstration particles');if(mesh)mesh.material.color.setRGB(3,3,3);}
 function makeParticles(){particles?.dispose();particles=mountParticles({scene,renderer,frame,metricId,reducedMotion,capacity:QUALITY[quality].particles});particles.setTime(seconds);particles.ready.then(ok=>{if(ok)gradeParticles();});if(!particlesOn)particles.setEnabled(false);return particles.ready;}
 try{columns=mountColumns({scene,renderer,frame,metricId,samplesPerRoad:4,maxHeight:72,capacity:2176});await Promise.all([columns.ready,makeParticles()]).then(values=>{if(values.some(v=>!v))throw Error('X-Ray layers could not initialize');});}catch(error){columns?.dispose();particles?.dispose();controls.dispose();city.dispose();throw error;}
 const api={scene,camera,frame,controls,
  beforeRender(now){
   if(closed)return;const canvas=renderer.domElement,w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight,key=w+':'+h;
   if(key!==projectionKey){projectionKey=key;camera.aspect=w/h;camera.updateProjectionMatrix();}
   if(last!==null&&playing&&!reducedMotion)seconds=(seconds+Math.min(.1,Math.max(0,(now-last)/1000)))%12;last=now;particles.setTime(seconds);controls.update();camera.updateMatrixWorld();
   const next=projectionKey+':'+camera.matrixWorld.elements.join(',')+':'+quality;
   if(next!==viewKey){viewKey=next;columns.setView({camera,stride:QUALITY[quality].stride});}
  },
  setLayer(name,value){if(name==='columns'){columnsOn=Boolean(value);columns.setEnabled(columnsOn);viewKey='';}else if(name==='particles'){particlesOn=Boolean(value);particles.setEnabled(particlesOn);gradeParticles();}else throw Error('Unknown X-Ray layer');},
  async setQuality(value){if(!QUALITY[value])throw RangeError('quality');if(value===quality||closed)return;quality=value;viewKey='';await makeParticles();},
  seek(value){if(!Number.isFinite(value)||value<0||value>12)throw RangeError('cosmetic seconds');seconds=value;particles.setTime(seconds);},
  setPlaying(value){playing=Boolean(value)&&!reducedMotion;last=null;},
  setReducedMotion(value){reducedMotion=Boolean(value);if(reducedMotion){playing=false;seconds=0;}controls.enableDamping=!reducedMotion;return makeParticles();},
  aerial,
  restoreCamera(){if(!savedPose)return false;camera.position.fromArray(savedPose.position);controls.target.fromArray(savedPose.target);controls.update();savedPose=null;return true;},
  pan(dx,dz){camera.position.x+=dx;camera.position.z+=dz;controls.target.x+=dx;controls.target.z+=dz;controls.update();},
  stats(){return {state:closed?'disposed':'ready',quality,seconds,playing,reducedMotion,columns:columns.stats(),particles:particles.stats(),contextBufferBytes:closed?0:city.bytes(),camera:camera.position.toArray(),target:controls.target.toArray()};},
  dispose(){if(closed)return;closed=true;playing=false;columns.dispose();particles.dispose();controls.dispose();city.dispose();}
 };
 return api;
}
