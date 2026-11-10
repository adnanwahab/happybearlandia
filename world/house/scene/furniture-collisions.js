/** Furniture bounds belong to the layout, not to the animation clock. Keep the
 * original meshes for picking; never traverse the entire scene for pet routes. */
export function createFurnitureCollisions(THREE,interior,{ignore=['rug','lamp','plant','flowers'],minHeight=.35}={}){
 const entries=new Map(),bounds=new THREE.Box3();let version=0,rows=[],lastDynamic=-Infinity;
 function update(now=0){let changed=false;const ids=new Set();for(const [id,object]of interior.objects){if(ignore.includes(object.record.type))continue;ids.add(id);object.group.updateWorldMatrix(true,false);const matrix=object.group.matrixWorld.elements;let e=entries.get(id);const dynamic=!!(object.fixture||object.nursery),refreshDynamic=dynamic&&now-lastDynamic>=250;if(!e||e.group!==object.group||matrix.some((n,i)=>n!==e.matrix[i])||refreshDynamic){bounds.setFromObject(object.group);e={group:object.group,matrix:Array.from(matrix),minX:bounds.min.x,maxX:bounds.max.x,minY:bounds.min.y,maxY:bounds.max.y,minZ:bounds.min.z,maxZ:bounds.max.z};entries.set(id,e);changed=true;}}for(const id of entries.keys())if(!ids.has(id)){entries.delete(id);changed=true;}if(now-lastDynamic>=250)lastDynamic=now;if(changed){rows=[...entries.values()].filter(b=>b.maxY>minHeight);version++;}return{rows,version};}
 return{update,clear(){entries.clear();rows=[];version++;lastDynamic=-Infinity;}};
}
