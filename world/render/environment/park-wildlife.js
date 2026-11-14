import * as THREE from 'three';
import {hashGrass, insidePolygon} from '../vegetation/grass-distribution.js';
export const WILDLIFE_LIMIT = 24;
// Authored decoration, not habitat observations. Private map-seed hash never
// consumes model random numbers, IDs or clocks.
export function wildlifeLayout(town = {}) {
  let seed = 0;
  for (const c of String(town.seedKey ?? 'park-toy-v1')) seed = Math.imul(seed, 31) + c.charCodeAt(0) | 0;
  const result = [];
  for (const park of town.buildings ?? []) {
    const poly = park.poly;
    if (park.kind !== 'park' || !Array.isArray(poly) || poly.length < 3 || !poly.every(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))) continue;
    const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
    const minX = Math.min(...xs), minZ = Math.min(...zs);
    const width = Math.max(...xs) - minX, depth = Math.max(...zs) - minZ;
    for (let i = 0, added = 0; i < 48 && added < 6 && result.length < WILDLIFE_LIMIT; i++) {
      const x = minX + width * hashGrass(minX, minZ, seed + i * 3);
      const z = minZ + depth * hashGrass(minX, minZ, seed + i * 3 + 1);
      if (!insidePolygon(x, z, poly)) continue;
      result.push({x, z, y: Math.max(.03, Number.isFinite(park.height) ? park.height : .3), phase: hashGrass(minX, minZ, seed + i * 3 + 2) * Math.PI * 2, kind: added % 3});
      added++;
    }
    if (result.length === WILDLIFE_LIMIT) break;
  }
  return result;
}
export function createParkWildlife(scene, town) {
  const layout = wildlifeLayout(town), group = new THREE.Group();
  group.name = 'Decorative park wildlife (not model agents)';
  const geometry = new THREE.SphereGeometry(1, 4, 2);
  const material = new THREE.MeshBasicMaterial({color: 0xffffff});
  const mesh = new THREE.InstancedMesh(geometry, material, WILDLIFE_LIMIT * 2);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  mesh.count = 0; mesh.frustumCulled = false; group.add(mesh); scene.add(group);
  let disposed = false;
  return {
    update(now, camera, {enabled = false, reducedMotion = false, quality = 'LOW', level = 0} = {}) {
      if (disposed) return;
      group.visible = enabled && !reducedMotion && quality !== 'LOW' && level < 2 && Number.isFinite(now) && camera.position.y < 42;
      mesh.count = 0;
      if (!group.visible) return;
      const seconds = now / 1000;
      for (const toy of layout) {
        if (Math.hypot(camera.position.x - toy.x, camera.position.z - toy.z) > 65) continue;
        const flap = Math.sin(seconds * (toy.kind === 0 ? 9 : 5) + toy.phase);
        for (let side = -1; side <= 1; side += 2) {
          dummy.position.set(toy.x + side * .18, toy.y + (toy.kind === 2 ? .2 : 1.2) + Math.abs(flap) * .15, toy.z);
          dummy.scale.set(.23, .07, toy.kind === 2 ? .12 : .3);
          dummy.rotation.set(0, toy.phase, side * flap * .7);
          dummy.updateMatrix(); mesh.setMatrixAt(mesh.count, dummy.matrix);
          color.setHex([0xf9ba64, 0x719fcb, 0xb98162][toy.kind]); mesh.setColorAt(mesh.count++, color);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    getStats() { return {decorative: true, available: layout.length, visible: mesh.count / 2, disposed}; },
    dispose() {
      if (disposed) return;
      disposed = true; mesh.count = 0; scene.remove(group);
      mesh.dispose(); geometry.dispose(); material.dispose();
    },
  };
}
