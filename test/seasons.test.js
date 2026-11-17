import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {seasonalStyle} from '../world/render/environment/seasons.js';
import {createCityDetails} from '../world/render/environment/city-details.js';
test('authored calendar has reversible boundaries and independent deterministic variants',()=>{
 expect(seasonalStyle(undefined)).toBeNull();expect(seasonalStyle(0,'off')).toBeNull();
 expect(seasonalStyle(0).season).toBe('spring');expect(seasonalStyle(90*1440).season).toBe('summer');expect(seasonalStyle(180*1440).season).toBe('autumn');expect(seasonalStyle(-1).season).toBe('winter');
 for(let i=0;i<100;i++)expect(seasonalStyle(i*1440,'auto','street-1')).toEqual(seasonalStyle(i*1440+360*1440,'auto','street-1'));
 expect(()=>seasonalStyle(0,'invalid')).toThrow();
});
test('rapid time/camera changes restore foliage, preserve source and dispose bounded resources',()=>{
 const scene=new THREE.Scene(),town={roads:[{pts:[[0,0],[100,0]]}],buildings:[]};
 const source=JSON.stringify(town),details=createCityDetails(scene,town),camera=new THREE.PerspectiveCamera();camera.position.set(0,20,0);
 const root=scene.getObjectByName('city-render-details'),foliage=details.groups.vegetation[1];
 const original=JSON.stringify(foliage.userData.transforms),settings={density:1,shadows:false},features={vegetation:true,props:true,rain:false};
 const update=(minute,season)=>details.update(0,0,camera,settings,features,{lighting:{minute},season});
 update(0,'winter');expect(JSON.stringify(foliage.userData.transforms)).not.toBe(original);
 for(let i=0;i<100;i++){camera.position.x=i;update(i*90*1440,'auto');}
 update(0,'off');expect(JSON.stringify(foliage.userData.transforms)).toBe(original);
 expect(details.groups.seasonal[0].visible).toBe(false);expect(details.groups.seasonal[0].count).toBeLessThanOrEqual(64);
 update(NaN,'auto');expect(JSON.stringify(foliage.userData.transforms)).toBe(original);
 expect(JSON.stringify(town)).toBe(source);
 let disposed=0;foliage.geometry.addEventListener('dispose',()=>disposed++);details.dispose();expect(disposed).toBe(1);expect(scene.children.includes(root)).toBe(false);
});
test('empty scene accepts season transitions without fabricated vegetation',()=>{
 const scene=new THREE.Scene(),details=createCityDetails(scene,{roads:[],buildings:[]});
 details.update(0,0,new THREE.PerspectiveCamera(),{density:1},{},{season:'winter'});
 expect(details.groups.vegetation[1].count).toBe(0);expect(details.groups.seasonal[0].count).toBe(0);details.dispose();
});
