/** Presentation phases follow committed action minutes. RAF only adds a small
 * repeating gesture; it never starts, completes or advances an action. */
export function everydayActivity(person){
 const action=person?.activeAction;
 if(!action||['completed','cancelled','interrupted'].includes(action.status)||(action.elapsedMinutes??0)<=0)return null;
 const pose=person.interaction?.pose,type=action.type;
 if(type==='cook'||pose==='prepare-food')return{kind:'cook',phase:action.elapsedMinutes<=Math.min(5,(action.durationMinutes??30)*.2)?'fetch':'prepare'};
 if(type==='eat'||type==='sharedDinner'||pose==='sit-eat')return{kind:'eat',phase:'eat'};
 if(pose==='shower'||pose==='wash'||pose==='use-toilet')return{kind:pose,phase:pose};
 return null;
}
export function buildFridge({THREE,group,x,z,box}){
 box(group,x,.98,z,1.12,1.96,1.05,'#d4dace');
 // Dark cavity remains behind the swinging, independently pickable door.
 box(group,x,1.03,z+.536,.94,1.65,.025,'#879989');
 for(const y of[.48,.95,1.42]){box(group,x,y,z+.57,.88,.035,.18,'#edf0dd');box(group,x-.2,y+.11,z+.56,.19,.2,.12,'#e4c77c');}
 const door=new THREE.Group();door.position.set(x-.56,0,z+.58);group.add(door);
 box(door,.56,1.02,0,1.12,1.9,.09,'#e3e7dc');box(door,.56,1.37,.056,1.08,.035,.025,'#b3bdad');box(door,.99,1.1,.11,.045,.48,.05,'#667b69');
 return{door};
}
export function updateFridge(fridge,open,phase){const dt=fridge.lastPhase===undefined?0:Math.max(0,Math.min(.1,phase-fridge.lastPhase));fridge.lastPhase=phase;const target=open?-Math.PI*.56:0;fridge.door.rotation.y+=(target-fridge.door.rotation.y)*(1-Math.exp(-dt*7));}

/** Bathroom fixtures are emitted only for actual installed inventory records. */
export function buildBathroomFixture({THREE,type,group,x,z,box,round}){
 if(type==='toilet'){
  round(group,x,.3,z,.25,.6,'#e7e8df');const bowl=round(group,x,.57,z+.1,.36,.19,'#faf9ed');bowl.scale.z=1.25;const water=round(group,x,.676,z+.13,.23,.012,'#98bcc0');water.scale.z=1.2;
  box(group,x,.88,z-.39,.7,.74,.25,'#f0f0e5');box(group,x+.23,1.17,z-.24,.12,.035,.05,'#a5afa8');
  return{seats:[{x,z:z+.1,seatTop:.67,floor:.2,heading:0,accessX:.75,accessZ:0}]};
 }
 if(type==='shower'){
  box(group,x,.25,z,1.35,.18,1.35,'#eeeadd');round(group,x,.35,z,.08,.015,'#7f918c');
  box(group,x,1.4,z-.61,1.35,2.2,.08,'#bad0c9');round(group,x,1.65,z-.52,.035,1.2,'#9baba5');box(group,x,2.23,z-.28,.33,.06,.46,'#a1b4ae');
  const water=new THREE.Group();group.add(water);for(let i=0;i<7;i++)round(water,x+(i%3-1)*.1,1.4,z-.17+Math.floor(i/3)*.1,.014,.16,'#b4dce0',6);water.visible=false;
  return{seats:[],water};
 }
 if(type==='sink'||type==='bathroomSink'){
  box(group,x,.5,z,.85,.9,.65,'#9bada3');box(group,x,.98,z,.95,.12,.75,'#f0eee1');round(group,x,1.05,z,.24,.025,'#b7ccc8');round(group,x,1.17,z-.23,.035,.3,'#98aba4');box(group,x,1.31,z-.13,.06,.06,.24,'#a8b8b1');return{seats:[]};
 }
 return null;
}
