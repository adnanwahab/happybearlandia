import {generateBuildingGeometry} from '../../render/geometry/building-generator.js';
import {disposeObjectResources} from './resources.js';

export const CONTEXT_NOTICE='Muted neighbors, streets and trees are decorative context · excluded from model inventory and all metrics.';
export function architectureGeometry(THREE,{id,height,polygon=null}) {
  const data=generateBuildingGeometry({id,kind:'home',height,footprint:polygon||[[-7,-7],[7,-7],[7,7],[-7,7]],architecture:{archetype:'walk-up',floors:Math.max(1,Math.round(height/3)),floorHeight:3}},'HIGH');
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(data.uvs,2));
  if(!polygon)geometry.translate(0,-height/2,0);
  geometry.parameters={height};return geometry;
}
export function facadeDetails(THREE,height,muted=false) {
  const group=new THREE.Group();group.userData.decorative=true;
  const material=new THREE.MeshStandardMaterial({color:muted?0x53666c:0xc5e0d6,roughness:.4});
  const geometry=new THREE.BoxGeometry(1.8,1.35,.12);
  for(let y=1.7;y<height;y+=3)for(const x of [-4,0,4])for(const side of [-1,1]) {
    const window=new THREE.Mesh(geometry,material);window.position.set(x,y-height/2,side*7.06);group.add(window);
    const flank=new THREE.Mesh(geometry,material);flank.rotation.y=Math.PI/2;flank.position.set(side*7.06,y-height/2,x);group.add(flank);
  }
  return group;
}
/** Stage-owned scenery only: never returned as City rows or pick targets. */
export function createNeighborhood(THREE,rows) {
  const group=new THREE.Group();group.userData.decorative=true;
  const schematic=rows.filter(r=>r.mapping==='synthetic-layout');if(!schematic.length)return group;
  const minX=Math.min(...schematic.map(r=>r.x))-30,maxX=Math.max(...schematic.map(r=>r.x))+30;
  const minZ=Math.min(...schematic.map(r=>r.z))-30,maxZ=Math.max(...schematic.map(r=>r.z))+30;
  function box(x,y,z,w,h,d,color){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.95}));mesh.position.set(x,y,z);group.add(mesh);return mesh;}
  box((minX+maxX)/2,-.7,(minZ+maxZ)/2,maxX-minX+50,1,maxZ-minZ+50,0x30443e);
  for(const z of [minZ+10,maxZ-10]){
    box((minX+maxX)/2,-.08,z,maxX-minX+45,.15,10,0x26323b);
    for(let x=minX-15;x<=maxX+15;x+=12)box(x,.03,z,5,.05,.3,0x819080);
    for(const edge of [-6,6])box((minX+maxX)/2,-.02,z+edge,maxX-minX+45,.2,2,0x657370);
  }
  for(let x=minX-12,i=0;x<=maxX+12;x+=22,i++)for(const z of [minZ-10,maxZ+10]){
    const height=6+(i%3)*3;
    const building=new THREE.Mesh(architectureGeometry(THREE,{id:`context-${i}-${z}`,height}),new THREE.MeshStandardMaterial({color:0x526568,roughness:.95}));
    building.position.set(x,height/2,z);building.add(facadeDetails(THREE,height,true));group.add(building);
    box(x+9,1.2,z+3,.6,2.4,.6,0x635c49);
    const tree=new THREE.Mesh(new THREE.IcosahedronGeometry(2.5,1),new THREE.MeshStandardMaterial({color:0x4c6c58}));tree.position.set(x+9,4,z+3);group.add(tree);
  }
  return group;
}
export function replaceDetails(THREE,mesh,row){
  const old=mesh.children.find(c=>c.userData.facade);if(old){mesh.remove(old);disposeObjectResources(old);}
  if(row.collection==='buildings'&&!row.polygon){const detail=facadeDetails(THREE,row.height);detail.userData.facade=true;mesh.add(detail);}
}
