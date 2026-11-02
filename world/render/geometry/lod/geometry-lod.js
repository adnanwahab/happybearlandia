export const GEOMETRY_BUDGETS=Object.freeze({hero:60000,building:8000,mediumBuilding:2000,farBuilding:100,vehicle:4000,tree:2000,prop:300});
export function projectedPixels(height,distance,fov,viewportHeight) {return height/Math.max(.01,2*distance*Math.tan(fov*Math.PI/360))*viewportHeight;}
export function geometryLOD(pixels,previous=1,selected=false) {
 if(selected)return 0;
 const thresholds=[280,80,12],target=pixels>=thresholds[0]?0:pixels>=thresholds[1]?1:pixels>=thresholds[2]?2:3;
 if(target===previous)return previous;
 const boundary=thresholds[Math.min(target,previous)];return Math.abs(pixels-boundary)<boundary*.15?previous:target;
}
export function updateGeometryLOD(camera,objects,settings={}) {
 const height=settings.viewportHeight||900;
 return objects.map(object=>{
  const position=object.position||{x:0,y:0,z:0},distance=Math.hypot(position.x-camera.position.x,position.y-camera.position.y,position.z-camera.position.z),pixels=projectedPixels(object.height||1,distance,camera.fov,height);
  return {...object,lod:geometryLOD(pixels,object.lod,object.selected),distance,screenPixels:pixels};
 });
}
