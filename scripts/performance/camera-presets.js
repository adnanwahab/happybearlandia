import {cameraObstacles,planCameraPreset} from '../../world/camera-presets.js';
// Synthetic stress geometry: not sourced buildings or a GPU/hardware certification.
const buildings=Array.from({length:1000},(_,i)=>{const x=(i%40)*30-600,z=Math.floor(i/40)*30-375;return {height:12+i%80,poly:[[x,z],[x+20,z],[x+20,z+20],[x,z+20]]};});
const times=[];let unavailable=0;
for(let i=0;i<2200;i++){
 const start=performance.now(),boxes=cameraObstacles(buildings);
 for(const kind of ['street','rooftop','skyline','follow'])if(!planCameraPreset(kind,{x:0,y:0,z:0},boxes))unavailable++;
 if(i>=200)times.push(performance.now()-start);
}
times.sort((a,b)=>a-b);
console.log(JSON.stringify({scope:'CPU: build 1000 synthetic building bounds + plan all four presets',runtime:Bun.version,samples:times.length,warmup:200,p50Ms:times[1000],p95Ms:times[1900],maxMs:times.at(-1),unavailable,limitations:'Local Bun microbenchmark; excludes rendering, browser event latency and GPU cost.'},null,2));
