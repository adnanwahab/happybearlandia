import * as THREE from 'three';
// Chunk membership is render-only: simulation state and original picking meshes survive.
export class CityVisibility {
  constructor(buildings, size = 128) {
    this.chunks = new Map(); this.frustum = new THREE.Frustum(); this.matrix = new THREE.Matrix4();
    for (const b of buildings) {
      const [x,z] = b.center, key = `${Math.floor(x/size)},${Math.floor(z/size)}`;
      if(!this.chunks.has(key)) this.chunks.set(key, { buildings: [], box: new THREE.Box3() });
      const chunk = this.chunks.get(key); chunk.buildings.push(b);
      b.mesh.geometry.computeBoundingBox(); chunk.box.union(b.mesh.geometry.boundingBox);
    }
  }
  update(camera, distance, selected, shadows = true, enabled = true) {
    camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(this.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse), camera.coordinateSystem);
    let visibleChunks = 0, visibleObjects = 0, shadowCasters = 0;
    for(const chunk of this.chunks.values()) {
      const visible = !enabled || (chunk.box.distanceToPoint(camera.position) < distance && this.frustum.intersectsBox(chunk.box));
      if(visible) visibleChunks++;
      for(const b of chunk.buildings) {
        const focus = String(b.id) === String(selected) || b.index === selected;
        b.mesh.visible = visible || focus;
        b.mesh.castShadow = shadows && b.kind !== 'park' && (focus || chunk.box.distanceToPoint(camera.position) < 550);
        if(b.mesh.visible) visibleObjects++;
        if(b.mesh.visible && b.mesh.castShadow) shadowCasters++;
      }
    }
    return { visibleChunks, visibleObjects, shadowCasters };
  }
}
