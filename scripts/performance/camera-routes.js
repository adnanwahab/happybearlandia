import {mkdirSync,writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {rendererCameraObstacles} from '../../world/render/camera-obstacles.js';
import {planCameraRoute,sampleCameraRoute} from '../../world/camera-route.js';
const buildings=Array.from({length:2048},(_,i)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(12,30,12));mesh.position.set((i%64)*30,15,Math.floor(i/64)*30);return {mesh};});
const times=[];
for(let i=0;i<1100;i++){
 const start=performance.now(),boxes=rendererCameraObstacles(buildings),route=planCameraRoute({x:-50,y:5,z:15},{x:2000,y:10,z:15+i%20},boxes);
 if(route.kind==='spline')sampleCameraRoute(route,.5);
 if(i>=100)times.push(performance.now()-start);
}
times.sort((a,b)=>a-b);
const receipt={issue:'SHE-616',runtime:Bun.version,fixture:'synthetic 2048 transformed box meshes; 100 warmup + 1000 measured plans',scope:'CPU bounds extraction + bounded route planning + one sample; excludes GPU, frame pacing, physical mobile',p50Ms:times[500],p95Ms:times[950],maxMs:times.at(-1)};
mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/she616-camera-routes.json',JSON.stringify(receipt,null,2)+'\n');console.log(receipt);
