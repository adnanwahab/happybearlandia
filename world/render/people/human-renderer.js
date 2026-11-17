/** Clothed articulated instances. Twelve shared meshes, no per-person scene
 * objects or skeletons. Gait phase follows distance actually drawn, not a timer.
 */
export const SHIRT_PALETTE=Object.freeze(['#e57373','#64b5f6','#81c784','#ffd54f','#ba68c8','#4dd0e1','#ff8a65','#a1887f','#90a4ae','#f06292','#7986cb','#aed581']);
export function shirtColorFor(id){let hash=2166136261;for(const char of String(id))hash=Math.imul(hash^char.charCodeAt(0),16777619);return SHIRT_PALETTE[(hash>>>0)%SHIRT_PALETTE.length];}
const NAMES=['TShirt','Pants','Skin','Hair','Shoes'];
const COLORS={TShirt:0xffffff,Pants:0x263449,Skin:0xc99068,Hair:0x30251f,Shoes:0x202126};
export function humanGait(distance,{ageBand='adult',moving=true}={}){
 const older=ageBand==='older'||ageBand==='senior',stride=ageBand==='child'?.65:older?.85:1.05,phase=distance/stride*Math.PI*2;
 return{phase,leg:moving?Math.sin(phase)*(older?.28:.42):0,arm:moving?-Math.sin(phase)*.35:0,bob:moving?Math.abs(Math.sin(phase))*(ageBand==='child'?.045:.018):0};
}
export function createHumanInstances({THREE,count,assetUrl='/world/assets/human-person.glb',loadAsset,readable=false}={}){
 if(!THREE||!Number.isInteger(count)||count<1||count>100000)throw new TypeError('Human instances require THREE and count 1–100000');
 const root=new THREE.Group();root.name='ClothedHumanInstances';
 const speechGeometry=new THREE.SphereGeometry(1,8,6),speechMaterial=new THREE.MeshBasicMaterial({color:'#eaf8fa',depthWrite:false}),speechBubbles=new THREE.InstancedMesh(speechGeometry,speechMaterial,count);speechBubbles.name='legacy-conversation-bubbles';speechBubbles.frustumCulled=false;speechBubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(speechBubbles);
 const questMaterial=new THREE.MeshBasicMaterial({color:'#ffd45e',depthWrite:false}),questBarGeometry=new THREE.BoxGeometry(1,1,1),questDotGeometry=new THREE.SphereGeometry(1,6,4),questBar=new THREE.InstancedMesh(questBarGeometry,questMaterial,count),questDot=new THREE.InstancedMesh(questDotGeometry,questMaterial,count);questBar.name='resident-help-markers';questDot.name='resident-help-marker-dots';for(const mesh of[questBar,questDot]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(mesh);}
 const questVisible=new Uint8Array(count);let questCount=0;
 const speechVisible=new Uint8Array(count);let speechCount=0;
 const parts=[],visible=new Uint8Array(count),states=new Array(count),distance=new Float64Array(count),dummy=new THREE.Object3D(),base=new THREE.Matrix4(),local=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scaleVector=new THREE.Vector3(),pivotVector=new THREE.Vector3(),color=new THREE.Color(),hoverWhite=new THREE.Color(0xffffff);let destroyed=false,dirty=false;
 const materials=Object.fromEntries(NAMES.map(name=>[name,new (readable?THREE.MeshBasicMaterial:THREE.MeshLambertMaterial)({color:COLORS[name]})]));
 const specs={TShirt:[['body',[.42,.55,.27],[0,1.18,0]],['left',[.14,.5,.16],[-.29,1.12,0]],['right',[.14,.5,.16],[.29,1.12,0]]],Pants:[['body',[.425,.16,.285],[0,.85,0]],['left',[.18,.69,.2],[-.115,.475,0]],['right',[.18,.69,.2],[.115,.475,0]]],Skin:[['body',[.29,.34,.29],[0,1.635,0]],['left',[.13,.36,.13],[-.31,1.05,0]],['right',[.13,.36,.13],[.31,1.05,0]]],Hair:[['body',[.29,.1,.29],[0,1.78,0]]],Shoes:[['left',[.175,.12,.30],[-.115,.06,.055]],['right',[.175,.12,.30],[.115,.06,.055]]]};
 const pivot=(name,side)=>side==='body'?[0,0,0]:['Pants','Shoes'].includes(name)?[(side==='left'?-1:1)*.115,.82,0]:[(side==='left'?-1:1)*.255,1.4,0];
 function addPart(name,side,geometry){const origin=pivot(name,side);geometry.translate(-origin[0],-origin[1],-origin[2]);const mesh=new THREE.InstancedMesh(geometry,materials[name],count);mesh.name=side==='body'?name:`${name}-${side}`;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.userData={humanPart:name,side,pivot:origin};root.add(mesh);parts.push(mesh);return mesh;}
 for(const name of NAMES)for(const [side,size,position]of specs[name])addPart(name,side,new THREE.BoxGeometry(...size).translate(...position));
 function write(index,state){
  const gait=humanGait(distance[index],state),bob=gait.bob;
  dummy.position.set(state.x,state.y+bob,state.z);dummy.rotation.set(0,state.heading,0);const scale=state.visible?state.scale*(state.selected?1.08:state.hovered?1.12:1):0;dummy.scale.setScalar(scale);dummy.updateMatrix();base.copy(dummy.matrix);
  dummy.position.set(state.x,state.y+2.3*state.scale,state.z);dummy.rotation.set(0,0,0);dummy.scale.set(state.speech&&state.visible ? .32*state.scale : 0,state.speech&&state.visible ? .22*state.scale : 0,state.speech&&state.visible ? .24*state.scale : 0);dummy.updateMatrix();speechBubbles.setMatrixAt(index,dummy.matrix);
  const helpScale=state.quest&&state.visible?state.scale:0;dummy.position.set(state.x,state.y+3*state.scale,state.z);dummy.scale.set(.08*helpScale,.28*helpScale,.08*helpScale);dummy.updateMatrix();questBar.setMatrixAt(index,dummy.matrix);dummy.position.y=state.y+2.76*state.scale;dummy.scale.setScalar(.055*helpScale);dummy.updateMatrix();questDot.setMatrixAt(index,dummy.matrix);
  for(const part of parts){const {humanPart:name,side,pivot:origin}=part.userData;const sign=side==='left'?1:-1,limb=['Pants','Shoes'].includes(name)?gait.leg:gait.arm;rotation.setFromAxisAngle(pivotVector.set(1,0,0),side==='body'?0:state.social&&!['Pants','Shoes'].includes(name)&&side==='right'?-.65+Math.sin(state.gesturePhase)*.18:sign*limb);local.compose(pivotVector.set(...origin),rotation,scaleVector.set(1,1,1));dummy.matrix.multiplyMatrices(base,local);part.setMatrixAt(index,dummy.matrix);if(name==='TShirt')part.setColorAt(index,color.set(state.shirtColor).lerp(hoverWhite,state.hovered?.45:0));}dirty=true;
 }
 function setPerson(index,{id=index,x=0,y=0,z=0,scale=1,heading=0,shirtColor,visible:shown=true,selected=false,hovered=false,ageBand='adult',social=false,speech=false,quest=false,gesturePhase=0,moving}={}){
  if(destroyed)return;if(!Number.isInteger(index)||index<0||index>=count)throw new RangeError('Human instance index out of range');if(![x,y,z,scale,heading,gesturePhase].every(Number.isFinite)||scale<0)throw new TypeError('Human transform must be finite with nonnegative scale');
  const previous=states[index],travel=previous?.id===id&&previous.visible&&shown?Math.hypot(x-previous.x,z-previous.z):0;
  if(previous?.id!==id)distance[index]=0;else if(travel<20)distance[index]+=travel; // teleports/reset are not steps
  const state={id,x,y,z,scale,heading,shirtColor:shirtColor??shirtColorFor(id),visible:!!shown,selected:!!selected,hovered:!!hovered,ageBand,social,speech,quest,gesturePhase,moving:moving??(travel>1e-5&&travel<20)};const questOn=state.quest&&state.visible?1:0;questCount+=questOn-questVisible[index];questVisible[index]=questOn;const speechOn=state.speech&&state.visible?1:0;speechCount+=speechOn-speechVisible[index];speechVisible[index]=speechOn;states[index]=state;visible[index]=shown&&scale>0?1:0;write(index,state);
 }
 function commit(){if(destroyed||!dirty)return;for(const mesh of[questBar,questDot]){mesh.visible=questCount>0;mesh.instanceMatrix.needsUpdate=true;mesh.boundingSphere=null;}speechBubbles.visible=speechCount>0;speechBubbles.instanceMatrix.needsUpdate=true;speechBubbles.boundingSphere=null;for(const part of parts){part.instanceMatrix.needsUpdate=true;part.boundingSphere=null;part.boundingBox=null;if(part.instanceColor)part.instanceColor.needsUpdate=true;}dirty=false;root.updateMatrixWorld(true);}
 for(let i=0;i<count;i++)setPerson(i,{visible:false});commit();
 function disposeScene(scene){scene?.traverse?.(node=>{if(node.isMesh){node.geometry?.dispose();for(const material of(Array.isArray(node.material)?node.material:[node.material]))material?.dispose();}});}
 const api={root,parts,setPerson,commit,pick(raycaster){if(destroyed||!root.visible)return null;const hit=raycaster.intersectObjects(parts,false).find(hit=>Number.isInteger(hit.instanceId)&&visible[hit.instanceId]);return hit?{...hit,index:hit.instanceId,id:states[hit.instanceId]?.id}:null;},destroy(){if(destroyed)return;destroyed=true;questMaterial.dispose();questBarGeometry.dispose();questDotGeometry.dispose();for(const mesh of[questBar,questDot]){mesh.dispose?.();root.remove(mesh);}speechGeometry.dispose();speechMaterial.dispose();speechBubbles.dispose?.();root.remove(speechBubbles);for(const part of parts){part.geometry.dispose();part.dispose?.();root.remove(part);}parts.length=0;for(const material of Object.values(materials))material.dispose();root.removeFromParent();},ready:null,assetStatus:'loading'};
 function articulate(name,geometry){
  const raw=geometry.index?geometry.toNonIndexed():geometry.clone(),buckets={body:[],left:[],right:[]},pos=raw.attributes.position;
  for(let i=0;i<pos.count;i+=3){const x=(pos.getX(i)+pos.getX(i+1)+pos.getX(i+2))/3,y=(pos.getY(i)+pos.getY(i+1)+pos.getY(i+2))/3;
   const limb=name==='Shoes'||name==='Pants'&&y<.78||(name==='TShirt'||name==='Skin')&&Math.abs(x)>.21&&y<1.46;
   const side=limb?(x<0?'left':'right'):'body';buckets[side].push(i,i+1,i+2);
  }
  const result=[];for(const [side,indices]of Object.entries(buckets)){if(!indices.length)continue;const g=new THREE.BufferGeometry();for(const [attribute,source]of Object.entries(raw.attributes)){const values=new Float32Array(indices.length*source.itemSize);indices.forEach((index,i)=>{for(let k=0;k<source.itemSize;k++)values[i*source.itemSize+k]=source.array[index*source.itemSize+k];});g.setAttribute(attribute,new THREE.BufferAttribute(values,source.itemSize));}result.push({name,side,geometry:g});}raw.dispose();return result;
 }
 api.ready=(async()=>{let scene;const geometries=[],articulated=[];try{
  const asset=loadAsset?await loadAsset(assetUrl):await new (await import('three/addons/loaders/GLTFLoader.js')).GLTFLoader().loadAsync(assetUrl);scene=asset.scene||asset;scene.updateMatrixWorld(true);
  for(const name of NAMES){const mesh=[];scene.traverse(node=>{if(node.isMesh&&(node.name===name||node.material?.name===name))mesh.push(node);});if(mesh.length!==1)throw new Error(`Expected one named ${name} mesh`);if(name!=='TShirt'&&mesh[0].material?.color)materials[name].color.copy(mesh[0].material.color);const geometry=mesh[0].geometry.clone().applyMatrix4(mesh[0].matrixWorld);geometries.push(geometry);articulated.push(...articulate(name,geometry));}
  if(destroyed){for(const {geometry}of articulated)geometry.dispose();return api;}
  for(const part of parts){root.remove(part);part.geometry.dispose();part.dispose?.();}parts.length=0;for(const {name,side,geometry}of articulated)addPart(name,side,geometry);for(let index=0;index<count;index++)write(index,states[index]);commit();api.assetStatus='ready';
 }catch(error){for(const {geometry}of articulated)geometry.dispose();api.assetStatus='fallback';api.assetError=error.message;}finally{for(const geometry of geometries)geometry.dispose();disposeScene(scene);}return api;})();
 return api;
}
