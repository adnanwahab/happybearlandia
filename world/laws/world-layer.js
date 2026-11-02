/** Dedicated overlays only: never change the town's meshes or invent facilities.
 * update({law,comparison?,mode:'potential'|'recorded',context?}) -> {summary,...}
 * Prefer catalog law.scope {buildingKinds,roads,people}. Recorded geography must
 * be supplied explicitly as comparison.visual.recorded{Building,Road,Person}Ids.
 */
const SCOPES={
 workplaces:[11,12,13,15,16,18,19,20,49,59,64,69],homes:[21,22,23,24,25,26,27,30,48,51,52,53,54,57,60],schools:[36,37,41,44,46,47,50,61,62,63,65,67,68,70,89],parks:[28,29,44,45,81,88,90,93,97,99],roads:[18,28,29,45,82,83,85,86,90,99],culture:[92,93,94,95,96,97,98,99,100],health:[31,32,33,34,35,38,39,40],government:[14,17,58,71,72,73,74,75,76,77,78,79,80,91]
};
export function lawPotentialScope(law){
 if(!law)return{buildingKinds:[],roads:false,people:false};
 const explicit=law.scope??law.mapping?.scope;if(explicit&&!Array.isArray(explicit))return{buildingKinds:explicit.buildingKinds||explicit.kinds||[],roads:explicit.roads===true,people:explicit.people===true,institution:explicit.institution||law.institution||null};
 const n=Number(law.number??String(law.id??'').match(/\d+/)?.[0]);const has=key=>SCOPES[key].includes(n),kinds=[];
 if(n>=92){const specific={92:['park','community','theatre','theater','arts_center','gallery'],93:['museum','park'],94:['worship','religious','place_of_worship','community'],95:['radio','tv_station','broadcasting','studio'],96:['school','community','library'],97:['park','community'],98:['community','library'],99:['museum','heritage','park'],100:['government','statistics','research']};return{buildingKinds:specific[n]||[],roads:has('roads'),people:false,institution:law.institution??null};}
 if(n===84)return{buildingKinds:['railway','train_station','rail_station'],roads:false,people:false};
 if(n===87)return{buildingKinds:['water','utility','water_works','water_tower'],roads:false,people:false};
 if(has('workplaces'))kinds.push('work','business','shop');if(has('homes'))kinds.push('home');if(has('schools'))kinds.push('school','university','college','childcare');if(has('parks'))kinds.push('park');if(has('culture'))kinds.push('museum','theatre','theater','community','library','worship');if(has('health'))kinds.push('hospital','clinic','healthcare');if(has('government'))kinds.push('government','public-agency','courthouse');if(n===28)kinds.push('food','shop','school');
 return{buildingKinds:[...new Set(kinds)],roads:has('roads'),people:false,institution:law.institution??null};
}
const ids=value=>new Set((Array.isArray(value)?value:[]).map(String));
export function mountLawWorldLayer({THREE,scene,town}={}){
 if(!THREE||!scene||!town)throw new TypeError('Law layer requires THREE, scene and town');
 const root=new THREE.Group();root.name='law-institution-overlays';scene.add(root);let destroyed=false,report={buildings:0,roads:0,people:0,mode:'potential',summary:'No law selected.'};
 function clear(){for(const child of [...root.children]){child.geometry?.dispose();child.material?.dispose();root.remove(child);}}
 let lineVertices=[];
 function line(points,dashed,color,closed=false){if(points.length<2)return;for(let i=1;i<points.length;i++)lineVertices.push(points[i-1],points[i]);if(closed)lineVertices.push(points.at(-1),points[0]);}
 function commitLines(dashed,color){if(!lineVertices.length)return;const geometry=new THREE.BufferGeometry().setFromPoints(lineVertices),material=dashed?new THREE.LineDashedMaterial({color,dashSize:4,gapSize:2,transparent:true,opacity:.9}):new THREE.LineBasicMaterial({color,transparent:true,opacity:.95});const mesh=new THREE.LineSegments(geometry,material);mesh.computeLineDistances();root.add(mesh);}

 return{
  update({law,comparison,mode='potential',context={}}={}){
   if(destroyed)return report;clear();lineVertices=[];report={buildings:0,roads:0,people:0,mode,summary:'No law selected.'};if(!law)return report;
   const potential=mode!=='recorded',scope=lawPotentialScope(law),visual=comparison?.visual??comparison?.recordedChanges??{},buildingIds=ids(visual.recordedBuildingIds??visual.buildingIds),roadIds=ids(visual.recordedRoadIds??visual.roadIds),personIds=ids(visual.recordedPersonIds??visual.personIds),color=potential?0x4ad8d0:0xffb45e;
   for(const b of town.buildings||[]){const selected=potential?[b.kind,b.institutionType,b.amenity,b.tags?.amenity,b.tags?.building,b.shop].some(kind=>scope.buildingKinds.includes(kind)):buildingIds.has(String(b.id))||buildingIds.has(`osm-${b.id}`);if(!selected||!Array.isArray(b.poly)||b.poly.length<3)continue;line(b.poly.map(([x,z])=>new THREE.Vector3(x,(b.height||0)+.35,z)),potential,color,true);report.buildings++;}
   for(const [index,road]of(town.roads||[]).entries()){if(!(potential?scope.roads:roadIds.has(String(road.id??index))))continue;line((road.pts||[]).map(([x,z])=>new THREE.Vector3(x,.4,z)),potential,color);report.roads++;}
   commitLines(potential,color);
   const people=context.people??context.snapshot?.visibleAgents??(context.mode==='living'?[]:town.people??[]),points=[];for(const p of people){if(!(potential?scope.people:personIds.has(String(p.id??p.personId)))||!Number.isFinite(p.x)||!Number.isFinite(p.z))continue;points.push(new THREE.Vector3(p.x,2.2,p.z));if(points.length===100)break;}
   if(points.length){const geometry=new THREE.BufferGeometry().setFromPoints(points),material=new THREE.PointsMaterial({color,size:7,sizeAttenuation:false});root.add(new THREE.Points(geometry,material));report.people=points.length;}
   const count=report.buildings+report.roads+report.people;report.summary=count?`${potential?'Potential institution scope (dashed teal), not recorded effects':'Recorded supplied changes (orange)'}: ${report.buildings} buildings, ${report.roads} road segments, ${report.people} people.${potential&&law.supported===false?' Modeled effects unavailable.':''}`:`No ${potential?'represented institution matches this scope; no geographic effect is inferred':(buildingIds.size+roadIds.size+personIds.size?'recorded entity IDs match the available town geometry; no geographic placement is inferred':'explicit recorded geographic IDs were supplied; no actual-change highlight is shown')}.`;
   return {...report};
  },getStats:()=>({...report}),clear(){clear();report={buildings:0,roads:0,people:0,mode:'potential',summary:'No law selected.'};},destroy(){if(destroyed)return;destroyed=true;clear();root.removeFromParent();}
 };
}
