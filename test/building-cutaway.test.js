import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {BuildingCutaway} from '../world/render/buildings/cutaway.js';
function fixture(){const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshStandardMaterial()),detailGeometry=new THREE.Group();scene.add(mesh,detailGeometry);detailGeometry.add(new THREE.Mesh(new THREE.BoxGeometry(8,.2,8),new THREE.MeshStandardMaterial()));detailGeometry.visible=false;return {scene,building:{id:'osm:123',kind:'home',mesh,detailGeometry}};}
test('roof transition reverses without replacing identity or neighbor geometry',()=>{
 const {scene,building}=fixture(),cut=new BuildingCutaway(scene),original=building.mesh.geometry,material=building.mesh.material;
 const neighbor=new THREE.Mesh(original,material);scene.add(neighbor);cut.select(building);expect(cut.setEnabled(true)).toBe(true);
 cut.update(0,.1);expect(cut.progress).toBeGreaterThan(0);expect(cut.progress).toBeLessThan(1);expect(neighbor.geometry).toBe(original);expect(material.opacity).toBe(1);expect(cut.roof.material.depthWrite).toBe(false);
 cut.update(1,1,true);expect(cut.progress).toBe(1);expect(building.detailGeometry.visible).toBe(true);expect(cut.status.id).toBe('osm:123');
 cut.setEnabled(false);cut.update(2,1,true);expect(building.mesh.geometry).toBe(original);expect(building.detailGeometry.visible).toBe(false);expect(scene.children.length).toBe(3);
});
test('missing geometry never fabricates an interior, and selection change restores shell',()=>{
 const {scene,building}=fixture(),cut=new BuildingCutaway(scene),original=building.mesh.geometry;
 cut.select({...building,detailGeometry:undefined});expect(cut.setEnabled(true)).toBe(false);cut.update(0);expect(scene.children.length).toBe(2);
 cut.select(building);cut.setEnabled(true);cut.update(0,.1);cut.select(null);expect(building.mesh.geometry).toBe(original);expect(cut.enabled).toBe(false);cut.dispose();
});
