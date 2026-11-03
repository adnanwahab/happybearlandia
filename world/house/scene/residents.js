import {shirtColorFor} from '../../render/people/human-renderer.js';
/** One procedural clothed figure per actual home member. Poses describe recorded
 * activity only; these figures never choose actions or mutate simulation state. */
export function createResident(THREE,interior,person){const root=new THREE.Group(),body=new THREE.Group();root.add(body);root.name='House resident '+person.id;const skin=person.skinColor??'#c99978',shirt=person.shirtColor??shirtColorFor(person.id),hair='#49392f';
 const mesh=(parent,x,y,z,w,h,d,color)=>interior.box(parent,x,y,z,w,h,d,color);
 const hip=mesh(body,0,.72,0,.37,.22,.28,'#46535a'),torso=mesh(body,0,1.05,0,.47,.52,.29,shirt);mesh(body,0,1.35,0,.13,.12,.14,skin);interior.sphere(body,0,1.56,0,.21,skin,.85,1.06,.9);interior.sphere(body,0,1.68,-.035,.208,hair,.9,.7,.95);mesh(body,0,1.73,0,.34,.08,.29,hair);
 for(const x of[-.075,.075])interior.sphere(body,x,1.58,.174,.018,'#39362d',1,1,.45);
 const arms=[],legs=[];for(const sign of[-1,1]){const arm=new THREE.Group();arm.position.set(sign*.31,1.24,0);body.add(arm);mesh(arm,0,-.11,0,.16,.25,.2,shirt);mesh(arm,0,-.35,0,.12,.3,.13,skin);interior.sphere(arm,0,-.53,0,.075,skin);arms.push(arm);const leg=new THREE.Group();leg.position.set(sign*.115,.68,0);body.add(leg);mesh(leg,0,-.29,0,.17,.58,.22,'#47545a');mesh(leg,0,-.61,.055,.2,.13,.36,'#54483c');legs.push(leg);}
 const ringGeometry=new THREE.RingGeometry(.38,.45,32),ringMaterial=new THREE.MeshBasicMaterial({color:'#d9f4a5',transparent:true,opacity:.95,side:THREE.DoubleSide,depthWrite:false}),ring=new THREE.Mesh(ringGeometry,ringMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=.215;root.add(ring);
 const markerGeometry=new THREE.OctahedronGeometry(.15),markerMaterial=new THREE.MeshStandardMaterial({color:'#a4dc79',emissive:'#4f782e',emissiveIntensity:.25}),marker=new THREE.Mesh(markerGeometry,markerMaterial);root.add(marker);marker.position.y=2.18;
 root.traverse(node=>{if(node.isMesh){node.userData.pick={kind:'person',id:String(person.id)};node.castShadow=true;}});root.userData.personId=String(person.id);const age=person.ageYears??30,scale=age<6?.52:age<13?.7:.97;body.scale.setScalar(scale);
 let pose='idle';function updatePose(next,time,selected){pose=next;body.rotation.set(0,0,0);body.position.set(0,.2,0);for(const arm of arms)arm.rotation.set(0,0,0);for(const leg of legs)leg.rotation.set(0,0,0);ring.visible=selected;marker.visible=selected;marker.position.y=(pose==='sleep'?1.3:2.15)*scale;marker.rotation.y=.4;
 const beat=Math.sin(time*2.6);if(pose==='sleep'){body.rotation.x=-Math.PI/2;body.position.set(0,.96+Math.sin(time*1.4)*.007,0);}
 else if(pose==='rest'||pose==='read'||pose==='work'){body.position.y=-.04;for(const leg of legs)leg.rotation.x=-1.12;for(const arm of arms)arm.rotation.x=pose==='rest'?-.25:-.85;if(pose==='read'){arms[0].rotation.z=-.2;arms[1].rotation.z=.2;}}
 else if(pose==='cook'){arms[0].rotation.x=-.7+beat*.12;arms[1].rotation.x=-1.1-beat*.2;}
 else if(pose==='clean'){arms[1].rotation.x=-.6+beat*.35;body.rotation.x=.13;}
 else if(pose==='music'){arms[0].rotation.z=.15+beat*.15;arms[1].rotation.z=-.15-beat*.15;body.rotation.y=beat*.04;}
 else if(pose==='dinner'){for(const leg of legs)leg.rotation.x=-1.05;body.position.y=-.02;arms[0].rotation.x=-.8+beat*.13;}
 else body.position.y+=Math.sin(time*1.8)*.008;
 }
 return{root,body,updatePose,destroy(){root.removeFromParent();ring.removeFromParent();marker.removeFromParent();root.traverse(node=>{if(node.geometry)interior.releaseGeometry(node.geometry);});ringGeometry.dispose();ringMaterial.dispose();markerGeometry.dispose();markerMaterial.dispose();}};
}
export function recordedPose(data,person){const action=(data.home.actions??[]).find(row=>row.id===person.activeActionId)?.type??person.houseAction??'',activity=String(person.needActivity??person.currentActivity??person.activity??'').toLowerCase();if(action==='rest')return person.roomId==='bedroom'?'sleep':'rest';if(action==='sharedDinner')return'dinner';if(action==='quietWorkspace'||action==='furniture')return'work';if(['cook','read','music','clean'].includes(action))return action;if(/sleep/.test(activity))return'sleep';if(/work/.test(activity))return'work';if(/meal|dining/.test(activity))return'dinner';return'idle';}
