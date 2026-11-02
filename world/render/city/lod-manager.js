import * as THREE from 'three';
// Keep original meshes as the stable picking/overlay interface. Far shells share
// one BatchedMesh per chunk, so simulation updates do not need renderer knowledge.
export class BuildingLOD {
  constructor(scene, chunks) {
    this.scene=scene;this.chunks=[];this.box=new THREE.BoxGeometry(1,1,1);this.matrix=new THREE.Matrix4();this.scale=new THREE.Vector3();this.position=new THREE.Vector3();this.rotation=new THREE.Quaternion();
    this.material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85});
    for(const chunk of chunks.values()) {
      // Flat landscape polygons must retain their outline: an axis-aligned box
      // covers streets around rotated/concave parks and always looks "far".
      const buildings=chunk.buildings.filter(b=>b.kind!=='park');
      if(!buildings.length)continue;
      const batch=new THREE.BatchedMesh(buildings.length,24,36,this.material);
      const geometryId=batch.addGeometry(this.box);batch.frustumCulled=false;batch.castShadow=false;batch.receiveShadow=true;batch.name='district-hlod';
      const entries=buildings.map(b=>({b,instance:batch.addInstance(geometryId),far:false}));
      scene.add(batch);this.chunks.push({batch,entries});
    }
  }
  update(camera,selected,enabled=true) {
    let instances=0;
    const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    for(const {batch,entries} of this.chunks) {
      batch.visible=enabled;
      for(const entry of entries) {
        const {b,instance}=entry,box=b.mesh.geometry.boundingBox;
        box.getCenter(this.position);box.getSize(this.scale);
        const distance=camera.position.distanceTo(this.position), projected=this.scale.y/Math.max(1,2*distance*tan);
        const focus=b.index===selected||String(b.id)===String(selected);
        if(focus||!enabled)entry.far=false;
        else if(!entry.far&&((distance>550&&projected<.06)||projected<.012))entry.far=true;
        else if(entry.far&&(distance<470||projected>.08)&&projected>.016)entry.far=false;
        const visible=b.mesh.visible&&entry.far;
        batch.setVisibleAt(instance,visible);
        if(visible){
          this.scale.y*=b.mesh.scale.y;this.position.y*=b.mesh.scale.y;
          this.matrix.compose(this.position,this.rotation,this.scale);batch.setMatrixAt(instance,this.matrix);batch.setColorAt(instance,b.mesh.material.color);b.mesh.visible=false;instances++;
        }
      }
    }
    return instances;
  }
  dispose(){for(const {batch} of this.chunks){this.scene.remove(batch);batch.dispose();}this.material.dispose();this.box.dispose();}
}
