/** Geometry for retained household-condition records. The caller supplies the
 * record and its room/object anchor; this module neither creates nor ages mess. */
export function buildConditionMesh({THREE,record,parent,x,z,y=.21,box,round,sphere,releaseGeometry=g=>g.dispose()}){
 const group=new THREE.Group();group.position.set(x,y,z);parent.add(group);group.userData.conditionId=record.id;const count=Math.max(1,Math.min(4,Math.ceil(record.amount??record.count??1))),kind=record.kind??record.type;
 if(kind==='dirtyDishes'||kind==='dishes'){for(let i=0;i<count;i++){round(group,0,.025+i*.035,0,.19,.025,'#e4dcc6');sphere(group,.04,.05+i*.035,.02,.07,'#9b7950',1,.16,.7);}box(group,.3,.13,.03,.12,.23,.12,'#c4c1a6');}
 else if(kind==='trash'){for(let i=0;i<count;i++)box(group,(i%2)*.17,.025+i*.012,Math.floor(i/2)*.16,.21,.035,.14,i%2?'#d6bf91':'#d8d4c2',i*.8);}
 else if(kind==='laundry'){for(let i=0;i<count;i++){const cloth=sphere(group,(i%2)*.17,.07+i*.04,Math.floor(i/2)*.1,.24,['#8fa8a6','#b69b87','#b7bfa5'][i%3],1,.3,.8);cloth.rotation.y=i;}}
 else if(kind==='spill'||kind==='spills'){for(let i=0;i<3;i++)sphere(group,(i-1)*.12,.012,Math.sin(i)*.1,.23,'#7d9d91',1,.035,.7);}
 else if(kind==='dust'){for(let i=0;i<5;i++)sphere(group,Math.sin(i*2)*.22,.012,Math.cos(i*2)*.2,.16,'#ada48e',1,.025,.6);}
 else if(kind==='clutter'){for(let i=0;i<count;i++)box(group,(i%2)*.2,.07+i*.015,Math.floor(i/2)*.2,.23,.1,.18,['#a59171','#8d9e8a','#b89978'][i%3],i*.5);}
 else if(kind==='fire'){for(let i=0;i<5;i++){const flame=sphere(group,Math.sin(i*2)*.22,.35+i*.07,Math.cos(i*2)*.18,.22,i%2?'#eeb352':'#dc7343',.65,1.8,.65);flame.userData.baseY=flame.position.y;flame.userData.baseScaleY=flame.scale.y;}}
 else if(kind==='broken'){for(const angle of[-.75,.75]){const bar=box(group,0,.12,0,.07,.5,.045,'#bf754e');bar.rotation.z=angle;}}
 else{group.removeFromParent();return null;}
 return{group,record,update(phase){if(kind==='fire')group.children.forEach((mesh,i)=>{mesh.scale.y=mesh.userData.baseScaleY*(1+Math.sin(phase*7+i)*.12);mesh.position.y=mesh.userData.baseY+Math.sin(phase*4+i)*.025;});},destroy(){group.removeFromParent();group.traverse(mesh=>{if(mesh.geometry)releaseGeometry(mesh.geometry);});}};
}
