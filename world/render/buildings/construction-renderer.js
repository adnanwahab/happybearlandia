import * as THREE from 'three';
import { generateConstructionGeometry } from '../geometry/construction-geometry.js';
export class ConstructionRenderer {
 constructor(scene){this.scene=scene;this.group=new THREE.Group();scene.add(this.group);this.geometry=new THREE.BoxGeometry(1,1,1);this.materials=new Map();this.key='';this.cranes=[];}
 update(projects=[]) {
  const key=JSON.stringify(projects);if(key===this.key)return;this.key=key;this.clear();
  const box=(group,x,y,z,w,h,d,color)=>{if(!this.materials.has(color))this.materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.8}));const mesh=new THREE.Mesh(this.geometry,this.materials.get(color));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);return mesh;};
  for(const p of projects) {
   const g=new THREE.Group();g.position.set(p.x||0,0,p.z||0);this.group.add(g);
   const w=Math.max(2,p.width||20),d=Math.max(2,p.depth||20),h=Math.max(3,p.height||40),progress=THREE.MathUtils.clamp(p.progress||0,0,1),phase=p.phase||'proposal';
   box(g,0,.2,0,w+4,.4,d+4,0x8b806d);
   if(phase==='proposal')continue;
   if(phase==='excavation'){box(g,0,.45,0,w,.5,d,0x493d2e);continue;}
   const built=Math.max(1,Math.floor(h*progress/3.4)),height=Math.min(h,built*3.4);
   if(['complete','interior','facade'].includes(phase))box(g,0,height/2,0,w,height,d,0x9da8ae);
   else {
    // Slabs and columns are merged to a single instanced draw per site.
    const skeleton=generateConstructionGeometry({...p,width:w,depth:d,height:h});
    const transforms=[...skeleton.slabs,...skeleton.columns,skeleton.core].map(t=>({p:t.position,s:t.scale}));
    if(skeleton.facade)box(g,...skeleton.facade.position,...skeleton.facade.scale,0x9da8ae);
    if(!this.materials.has('frame'))this.materials.set('frame',new THREE.MeshStandardMaterial({color:0xaaa99e}));
    const mesh=new THREE.InstancedMesh(this.geometry,this.materials.get('frame'),transforms.length),tmp=new THREE.Object3D();transforms.forEach((t,i)=>{tmp.position.set(...t.p);tmp.scale.set(...t.s);tmp.updateMatrix();mesh.setMatrixAt(i,tmp.matrix)});g.add(mesh);
   }
   if(phase!=='complete') {
    const crane=new THREE.Group();crane.position.set(w/2+5,0,0);g.add(crane);const ch=h+12;
    box(crane,0,ch/2,0,.9,ch,.9,0xdaa62d);const jib=new THREE.Group();jib.position.y=ch;crane.add(jib);box(jib,9,0,0,32,.8,.8,0xdaa62d);box(jib,20,-8,0,.15,16,.15,0x5d6264);this.cranes.push(jib);
    for(const sign of [-1,1]){box(g,0,1.2,sign*(d/2+4),w+8,2.4,.2,0x3b797c);box(g,sign*(w/2+4),1.2,0,.2,2.4,d+8,0x3b797c);}
   }
  }
 }
 animate(now,visible=true){this.group.visible=visible;for(let i=0;i<this.cranes.length;i++)this.cranes[i].rotation.y=now*.00006+i;}
 clear(){this.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});this.group.clear();this.cranes=[];}
 dispose(){this.clear();this.geometry.dispose();for(const m of this.materials.values())m.dispose();this.scene.remove(this.group);}
}
