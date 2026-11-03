/** Persisted build edits are presentation inputs. Openings are actual missing
 * wall geometry, so raycasts and views pass through their apertures. */
export function buildDesignVisuals({THREE,data,geometry,parent,box,round,pickables,wallMeshes,wallRecords=[],ownGeometry,ownMaterial}){
 const design=data.home?.build;if(!design)return{groups:[]};const groups=[];
 const definitions=[...geometry.walls,...(design.rooms??[]).flatMap(room=>room.polygon.map((a,i)=>({id:room.id+'-wall-'+i,a,b:room.polygon[(i+1)%room.polygon.length]})))];
 for(const wall of definitions){const openings=(design.openings??[]).filter(o=>o.wallId===wall.id),color=design.paints?.[wall.id],added=wall.id.startsWith('build-room-');if(!added&&!color&&!openings.length)continue;
  const originals=wallRecords.filter(r=>r.wall.userData.pick?.record.id===wall.id);for(const old of originals){old.wall.visible=false;old.crown.visible=false;if(old.window)old.window.visible=false;for(let i=pickables.length-1;i>=0;i--)if(pickables[i]===old.wall)pickables.splice(i,1);}
  const dx=wall.b.x-wall.a.x,dz=wall.b.z-wall.a.z,length=Math.hypot(dx,dz),group=new THREE.Group();group.position.set((wall.a.x+wall.b.x)/2,.2,(wall.a.z+wall.b.z)/2);group.rotation.y=-Math.atan2(dz,dx);parent.add(group);groups.push(group);
  const record={id:wall.id,a:wall.a,b:wall.b},segments=[];
  function panel(lo,hi,bottom,top){if(hi-lo<.001||top-bottom<.001)return;const mesh=box(group,(lo+hi)/2,(bottom+top)/2,0,hi-lo,top-bottom,.14,color??'#d8cdb5');mesh.userData.pick={kind:'wall',record};pickables.push(mesh);mesh.userData.wallSpan={bottom,top};segments.push(mesh);}
  let cursor=-length/2;for(const o of [...openings].sort((a,b)=>a.offset-b.offset)){const mid=(o.offset-.5)*length,lo=mid-o.width/2,hi=mid+o.width/2;panel(cursor,lo,0,2.4);const sill=o.type==='window'?.9:0,top=o.type==='window'?1.9:2.1;panel(lo,hi,0,sill);panel(lo,hi,top,2.4);
   for(const x of[lo,hi])box(group,x,(sill+top)/2,0,.07,top-sill,.20,'#8b7659');box(group,mid,top,0,o.width+.08,.07,.20,'#8b7659');
   if(o.type==='window'){box(group,mid,sill,0,o.width+.08,.07,.20,'#8b7659');const glass=box(group,mid,(sill+top)/2,0,o.width-.06,top-sill-.06,.025,'#bed7d3');glass.material=ownMaterial(new THREE.MeshStandardMaterial({color:'#bed7d3',transparent:true,opacity:.24,depthWrite:false}));}
   else{const leaf=new THREE.Group();leaf.position.set(lo,0,0);leaf.rotation.y=-1.1;group.add(leaf);box(leaf,o.width/2,1.02,0,o.width-.06,2.04,.06,'#aa9878');round(leaf,o.width-.13,1,.06,.035,.06,'#bda15d');}
   cursor=hi;
  }panel(cursor,length/2,0,2.4);if(segments[0])wallMeshes.set(wall.id,segments[0]);group.userData.normal={x:-dz/length,z:dx/length};group.userData.panels=segments;group.traverse(mesh=>{if(mesh.isMesh&&!mesh.userData.pick){mesh.userData.pick={kind:'wall',record};pickables.push(mesh);}});
 }
 for(const room of design.rooms??[]){const points=room.polygon,shape=new THREE.Shape();points.forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));shape.closePath();const mesh=new THREE.Mesh(ownGeometry(new THREE.ShapeGeometry(shape)),ownMaterial(new THREE.MeshStandardMaterial({color:'#d7c39b',roughness:1})));mesh.rotation.x=-Math.PI/2;mesh.position.y=.207;mesh.userData.floorBase={polygons:THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(p.x,p.z)),[]).map(face=>face.map(i=>[points[i].x,points[i].z])),y:.207};mesh.userData.pick={kind:'room',record:{id:room.id,name:room.name,build:true}};parent.add(mesh);pickables.push(mesh);}
 return{groups};
}
