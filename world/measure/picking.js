import {footprintArea,snapPoint} from './model.js';
import {isRenderedHit} from '../render/magnetic-picking.js';
export function pickMeasurementSurface(THREE,{camera,meshes,rect,x,y,snap}){
 camera.updateMatrixWorld();const picker=new THREE.Raycaster();picker.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),camera);
 const hit=picker.intersectObjects(meshes).find(isRenderedHit);
 if(hit){const b=hit.object.userData.b;if(!b)return null;let point={x:hit.point.x,y:hit.point.y,z:hit.point.z};const corners=(b.poly||[]).flatMap(([x,z])=>[0,b.height].map(y=>({x,y,z})));if(snap)point=snapPoint(point,corners);return {point,tag:`${b.kind||'building'} ${b.id} · scene shell`,area:footprintArea(b.poly)};}
 const point=picker.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());return point&&picker.ray.origin.distanceTo(point)<=camera.far?{point:{x:point.x,y:0,z:point.z},tag:'scene ground plane'}:null;
}
