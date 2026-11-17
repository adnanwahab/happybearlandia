import {test,expect} from 'bun:test';
import {planCameraRoute,sampleCameraRoute,clearCameraSegment} from '../world/camera-route.js';
const boxes=[{minX:-20,maxX:20,minZ:-20,maxZ:20,top:100}];
for(let i=0;i<20;i++)test(`synthetic destination ${i}: continuous verified cubic spans`,()=>{
 const a={x:-100,y:10,z:i-10},b={x:100,y:5+i,z:10-i},route=planCameraRoute(a,b,boxes);
 expect(route.kind).toBe('spline');expect(route.points.length).toBe(4);
 let previous=a;
 for(let j=0;j<=200;j++){const p=sampleCameraRoute(route,j/200);expect(Object.values(p).every(Number.isFinite)).toBe(true);expect(clearCameraSegment(previous,p,boxes)).toBe(true);previous=p;}
 expect(previous).toEqual(b);
});
test('thin walls intersect between samples; touching boundaries is blocked',()=>{
 expect(clearCameraSegment({x:-100,y:4,z:0},{x:100,y:4,z:0},[{minX:.001,maxX:.002,minZ:-1,maxZ:1,top:5}])).toBe(false);
 expect(clearCameraSegment({x:20,y:100,z:20},{x:20,y:100,z:20},boxes)).toBe(false);
});
test('unsupported, missing, invalid, occupied and budget fallbacks',()=>{
 const a={x:-100,y:5,z:0},b={x:100,y:5,z:0};
 expect(planCameraRoute(a,b,null).kind).toBe('unavailable');
 expect(planCameraRoute(a,{...b,x:NaN},[]).kind).toBe('unavailable');
 expect(planCameraRoute(a,{x:0,y:5,z:0},boxes).kind).toBe('unavailable');
 expect(planCameraRoute(a,b,[{...boxes[0],top:1300}]).kind).toBe('cut');
 expect(planCameraRoute(a,b,Array(2049).fill(boxes[0])).reason).toBe('geometry-budget');
 expect(planCameraRoute({x:0,y:5,z:0},b,boxes).reason).toBe('blocked-start');
 expect(planCameraRoute(a,b,[]).kind).toBe('spline');
 expect(sampleCameraRoute(planCameraRoute(a,a,[]),0)).toEqual(a);
});

import * as THREE from 'three';
import {rendererCameraObstacles} from '../world/render/camera-obstacles.js';
test('renderer bounds include actual roof geometry and transformed heights',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(20,40,30));mesh.position.set(10,20,30);mesh.scale.y=2;
 const boxes=rendererCameraObstacles([{mesh,height:1,poly:[[0,0]]}]);
 expect(boxes).toEqual([{minX:-3,maxX:23,minZ:12,maxZ:48,top:63}]);
 expect(planCameraRoute({x:-100,y:40,z:30},{x:100,y:40,z:30},boxes).points.length).toBe(4);
 expect(rendererCameraObstacles([{}])).toBeNull();
});
