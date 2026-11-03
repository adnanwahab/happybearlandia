/** Clause scopes are declared model domains; recorded differences require stable IDs. */
export function constitutionWorldScope({town={},clause,baseline,current,diff,mode='scope'}={}){
 const buildings=town.buildings||[],roads=town.roads||[];
 if(!clause)return{mode,buildingIds:[],roadIndices:[],personIds:[],summary:'No clause selected; highlights cleared.',limitations:[]};
 if(clause.supported!==true)return{mode,buildingIds:[],roadIndices:[],personIds:[],summary:`Forecast unavailable for ${clause.title||clause.id}; no city effects are invented.`,limitations:clause.limitations||[]};
 const type=clause.mapping?.type;
 if(mode==='scope'){
  const selected=type==='upzone'?buildings.filter(b=>b.kind==='home'):type==='resilience'?buildings.filter(b=>b.kind!=='park'):[];
  const roadIndices=type==='transit'?roads.map((_,i)=>i):[];
  return{mode,buildingIds:selected.map(b=>String(b.id)),roadIndices,personIds:[],summary:`Potential ${clause.mapping?.label||type} scope: ${selected.length} mapped footprints${roadIndices.length?` and ${roadIndices.length} road traces`:''}. Geographic eligibility and individual beneficiaries are not established.`,limitations:['Potential scope is not a recorded effect or a parcel-level legal/flood/transit finding.','Daily residents are not identified with monthly forecast households; no invented person matching.']};
 }
 const changed=diff?.changes||{},ids=new Set();
 const sourceMap=new Map([...(baseline?.buildings||[]),...(current?.buildings||[])].map(b=>[b.id,String(b.sourceId||b.id.replace(/^osm-/,''))]));
 for(const b of changed.buildings||[])if(b.status!=='unchanged'&&sourceMap.has(b.id))ids.add(sourceMap.get(b.id));
 for(const u of changed.units||[])if(u.status!=='unchanged'){const actual=(current?.units||[]).find(row=>row.id===u.id)||(baseline?.units||[]).find(row=>row.id===u.id);const b=u.after?.buildingId||u.before?.buildingId||actual?.buildingId;if(sourceMap.has(b))ids.add(sourceMap.get(b));}
 return{mode:'recorded',buildingIds:buildings.filter(b=>ids.has(String(b.id))).map(b=>String(b.id)),roadIndices:[],personIds:[],summary:`${ids.size} mapped source footprint references in supplied recorded changes. Other changes lack a direct geographic or person match.`,limitations:['No unrecorded household/person or district-to-road identity is inferred.']};
}
export function mountConstitutionWorldLayer({THREE,scene,town}={}){
 if(!THREE||!scene||!town)throw Error('World Diff layer requires THREE, scene and town.');
 const root=new THREE.Group();root.name='constitution-clause-scope';scene.add(root);let last=null,destroyed=false;
 function clear(){for(const child of [...root.children]){child.geometry?.dispose();child.material?.dispose();root.remove(child);}}
 return{update(input={}){
  if(destroyed)return null;clear();last=constitutionWorldScope({town,...input});
  const chosen=new Set(last.buildingIds),color=last.mode==='scope'?0xe6b65d:0x62d9b0;
  for(const b of town.buildings||[]){if(!chosen.has(String(b.id))||!Array.isArray(b.poly)||b.poly.length<3)continue;const y=Math.max(.4,b.height||.3)+.3;
   const points=[...b.poly,b.poly[0]].map(([x,z])=>new THREE.Vector3(x,y,z));const geometry=new THREE.BufferGeometry().setFromPoints(points);const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.95,depthTest:false}));line.renderOrder=200;line.userData.sourceBuildingId=String(b.id);root.add(line);
  }
  for(const index of last.roadIndices){const road=town.roads[index],points=(road.pts||[]).filter(p=>p.length>=2&&p.every(Number.isFinite)).map(([x,z])=>new THREE.Vector3(x,.5,z));if(points.length<2)continue;const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity:.85,depthTest:false}));line.renderOrder=200;root.add(line);}
  return last;
 },getStats(){return{...last,drawObjects:root.children.length};},destroy(){if(destroyed)return;destroyed=true;clear();scene.remove(root);}};
}
