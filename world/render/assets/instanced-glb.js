import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function disposeSource(gltf) {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  gltf.scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of object.material?[object.material].flat():[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
  for(const texture of textures)texture.dispose();for(const material of materials)material.dispose();for(const geometry of geometries)geometry.dispose();
}
export function validateDetailAsset(gltf,{maxParts=8,maxTriangles=20000}={}) {
  const parts=[];let triangles=0,draws=0;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(object=>{
    if(object.isSkinnedMesh||object.morphTargetInfluences?.length)throw new Error('Detail GLBs must be static, without skinning or morph targets');
    if(!object.isMesh)return;
    const count=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;
    triangles+=count;draws+=Array.isArray(object.material)?object.geometry.groups.length:1;
    parts.push({geometry:object.geometry,material:object.material,matrix:object.matrixWorld.clone()});
  });
  if(!parts.length||draws>maxParts||triangles>maxTriangles)throw new Error(`Detail GLB exceeds its budget: ${draws}/${maxParts} draws, ${triangles}/${maxTriangles} triangles`);
  return {parts,triangles,draws};
}
export class DetailAssetLibrary {
  constructor(scene){this.scene=scene;this.loader=new GLTFLoader();this.handles=new Set();this.disposed=false;}
  async load({url,transforms=[],category='props',maxDistance=60,maxTriangles=20000,maxParts=8}={}) {
    if(this.disposed)throw new Error('Asset library is disposed');
    if(typeof url!=='string'||!url.toLowerCase().split('?')[0].endsWith('.glb'))throw new TypeError('Provide a .glb URL');
    if(!Array.isArray(transforms)||transforms.length<1||transforms.length>5000)throw new RangeError('Provide 1–5000 instance transforms');
    if(!Number.isFinite(maxDistance)||maxDistance<=0)throw new RangeError('Asset distance must be positive');
    const objects=transforms.map(t=>{
      const position=t.position||[0,0,0],scale=t.scale||[1,1,1],rotation=t.rotation||0;
      if(position.length!==3||scale.length!==3||![...position,...scale,rotation].every(Number.isFinite)||scale.some(v=>v<=0))throw new TypeError('Asset transforms require finite position, positive scale, and Y rotation in radians');
      return {position:[...position],scale:[...scale],rotation};
    });
    const gltf=await this.loader.loadAsync(url);
    let budget;
    try{if(this.disposed)throw new Error('Asset library is disposed');budget=validateDetailAsset(gltf,{maxParts,maxTriangles});}catch(error){disposeSource(gltf);throw error;}
    const group=new THREE.Group();group.name=`detail-asset:${url}`;
    const meshes=budget.parts.map(part=>{const mesh=new THREE.InstancedMesh(part.geometry,part.material,objects.length);mesh.count=0;mesh.receiveShadow=true;mesh.castShadow=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(mesh);return mesh;});
    this.scene.add(group);
    const dummy=new THREE.Object3D(),matrix=new THREE.Matrix4();let dead=false,last=-Infinity,count=0;
    const handle={
      update(now,camera,settings,features){
        group.visible=features.assets!==false&&features[category]!==false;
        if(dead||!group.visible||now-last<200)return;last=now;count=0;
        for(const [i,t] of objects.entries()){
          if((i*.61803398875)%1>(settings.density??1)||Math.hypot(t.position[0]-camera.position.x,t.position[1]-camera.position.y,t.position[2]-camera.position.z)>maxDistance)continue;
          dummy.position.set(...t.position);dummy.scale.set(...t.scale);dummy.rotation.set(0,t.rotation,0);dummy.updateMatrix();
          budget.parts.forEach((part,j)=>{matrix.multiplyMatrices(dummy.matrix,part.matrix);meshes[j].setMatrixAt(count,matrix);});count++;
        }
        for(const mesh of meshes){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
      },
      getStats(){return {url,instances:group.visible?count:0,trianglesPerInstance:budget.triangles,drawCalls:group.visible&&count?budget.draws:0};},
      dispose:()=>{if(dead)return;dead=true;this.scene.remove(group);for(const mesh of meshes)mesh.dispose();disposeSource(gltf);this.handles.delete(handle);},
    };
    this.handles.add(handle);return handle;
  }
  update(now,camera,settings,features){for(const handle of this.handles)handle.update(now,camera,settings,features);}
  getStats(){return [...this.handles].map(handle=>handle.getStats());}
  dispose(){this.disposed=true;for(const handle of [...this.handles])handle.dispose();}
}
