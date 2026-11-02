/** Original low-poly clothed human, CC0. Rebuild: bun scripts/generate-human-person.mjs */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mkdir, writeFile } from 'node:fs/promises';

// GLTFExporter uses browser FileReader even for texture-free binary exports.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result=result; this.onloadend?.(); }).catch(error => { this.error=error; this.onerror?.(error); }); }
};
const scene=new THREE.Scene(),human=new THREE.Group();human.name='ClothedHuman';scene.add(human);
human.userData={license:'CC0-1.0',generator:'HappyBearLandia original procedural human v1',units:'meters',up:'+Y',forward:'+Z',shirtMaterial:'TShirt'};
const parts={TShirt:[],Pants:[],Skin:[],Hair:[],Shoes:[]};
function add(part,geometry,{x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1}={}) {
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(sx,sy,sz));
  const baked=geometry.index?geometry.toNonIndexed():geometry;
  baked.applyMatrix4(matrix);parts[part].push(baked);
}
// Short-sleeved shirt, relaxed arms and separate trouser legs.
add('TShirt',new THREE.CylinderGeometry(.205,.225,.51,8),{y:1.18,sz:.66});
add('TShirt',new THREE.BoxGeometry(.40,.13,.27),{y:.94});
for(const side of [-1,1]) {
  add('TShirt',new THREE.CylinderGeometry(.105,.11,.22,8),{x:side*.255,y:1.315,rz:side*.28});
  add('Skin',new THREE.CylinderGeometry(.060,.067,.36,8),{x:side*.31,y:1.05,rz:side*.10});
  add('Skin',new THREE.SphereGeometry(.071,8,6),{x:side*.33,y:.865,sy:1.13,sz:.76});
  add('Pants',new THREE.CylinderGeometry(.092,.102,.69,8),{x:side*.115,y:.475,sz:.95});
  add('Shoes',new THREE.BoxGeometry(.175,.12,.30),{x:side*.115,y:.06,z:.055});
  add('Hair',new THREE.SphereGeometry(.017,6,4),{x:side*.052,y:1.642,z:.144});
  add('Skin',new THREE.SphereGeometry(.038,6,4),{x:side*.148,y:1.62,sz:.7});
}
add('Pants',new THREE.BoxGeometry(.425,.16,.285),{y:.85});
add('Skin',new THREE.CylinderGeometry(.065,.07,.10,8),{y:1.47});
add('Skin',new THREE.SphereGeometry(.165,10,8),{y:1.635,sx:.9,sy:1.12,sz:.88});
add('Skin',new THREE.SphereGeometry(.030,6,4),{y:1.618,z:.15,sz:1.35});
add('Hair',new THREE.SphereGeometry(.169,10,6,0,Math.PI*2,0,Math.PI*.54),{y:1.648,sx:.92,sz:.90});
const colors={TShirt:0x62b4cf,Pants:0x293b58,Skin:0xc89472,Hair:0x30251f,Shoes:0x262d32};
for(const [name,geometries] of Object.entries(parts)) {
  const geometry=mergeGeometries(geometries,false);
  if(!geometry)throw new Error(`Cannot merge ${name}`);
  const material=new THREE.MeshStandardMaterial({color:colors[name],roughness:.95,metalness:0,flatShading:true});material.name=name;
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;human.add(mesh);
}
const output=new URL('../world/assets/human-person.glb',import.meta.url);
await mkdir(new URL('../world/assets/',import.meta.url),{recursive:true});
const binary=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});
await writeFile(output,new Uint8Array(binary));
const bounds=new THREE.Box3().setFromObject(human),size=bounds.getSize(new THREE.Vector3());
console.log(JSON.stringify({file:output.pathname,bytes:binary.byteLength,parts:human.children.map(mesh=>mesh.name),heightMeters:size.y,license:'CC0-1.0'}));
