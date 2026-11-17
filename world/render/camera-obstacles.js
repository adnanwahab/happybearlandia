import {Box3} from 'three';
/** Renderer geometry authority, including roof vertices and world transforms.
 * Hidden shells remain conservative obstacles because LOD can hide a shell while
 * displaying its batched equivalent. Unsupported meshes hold automatic motion.
 */
export function rendererCameraObstacles(buildings){
 const result=[];
 for(const b of buildings){
  if(b.kind==='park')continue;
  const mesh=b.mesh,geometry=mesh?.geometry;
  if(!geometry?.getAttribute('position'))return null;
  if(!geometry.boundingBox)geometry.computeBoundingBox();
  mesh.updateWorldMatrix(true,false);
  const box=new Box3().copy(geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
  if(![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite))return null;
  result.push({minX:box.min.x-3,maxX:box.max.x+3,minZ:box.min.z-3,maxZ:box.max.z+3,top:box.max.y+3});
 }
 return result;
}
