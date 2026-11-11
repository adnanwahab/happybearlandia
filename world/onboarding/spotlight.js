import {sceneEntityReference,scenePosition} from './camera-director.js';

/** A static, ground-parallel ring at an actual resolved resident/building position.
 * No pulse, invented footprint, result color, simulation change, or private RAF.
 * An injected THREE keeps importing this module safe without DOM/WebGL.
 */
export function createSpotlight({THREE,scene,resolveEntity,getResidentPosition,reducedMotion=false,available=true,radius=3,color=0xffd76a,onChange=()=>{}}={}) {
  const resolveSceneEntity=resolveEntity??(ref=>ref.authority==='legacy-world'&&ref.kind==='resident'&&getResidentPosition?{position:getResidentPosition(ref.id)}:null);
  let mesh=null,reference=null,disposed=false,reason='idle';
  const state=()=>({active:reference!==null,reference:reference?{...reference}:null,reason});
  function clear(why='cancelled'){const active=reference!==null;reference=null;reason=why;if(mesh)mesh.visible=false;if(active)onChange(state());return active;}
  function resolve(ref){try{return scenePosition(resolveSceneEntity(ref));}catch{return null;}}
  function ensureMesh(){
    if(mesh)return true;
    if(!available||!scene?.add||!THREE?.RingGeometry||!THREE?.MeshBasicMaterial||!THREE?.Mesh||!Number.isFinite(radius)||radius<=0)return false;
    const geometry=new THREE.RingGeometry(radius*.78,radius,48);
    const material=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false});
    mesh=new THREE.Mesh(geometry,material);mesh.name='world-onboarding-entity-highlight';mesh.rotation.x=-Math.PI/2;mesh.visible=false;scene.add(mesh);return true;
  }
  function show(ref){
    if(disposed)return false;
    clear('replaced');
    if(!sceneEntityReference(ref)){reason='unavailable';return false;}
    const next={authority:ref.authority,kind:ref.kind,id:ref.id};
    if(!resolve(next)){reason='entity-unavailable';return false;}
    if(!ensureMesh()){reason='unavailable';return false;}
    reference=next;reason='highlighted';update();onChange(state());return true;
  }
  function update(){if(disposed||!reference)return false;const p=resolve(reference);if(!p){clear('entity-unavailable');return false;}mesh.position.set(p.x,p.y+.15,p.z);mesh.visible=true;return true;}
  return {showResident:id=>show({authority:'legacy-world',kind:'resident',id}),show,highlight:show,update,clear,cancel:clear,getState:state,dispose(){if(disposed)return;clear('disposed');disposed=true;if(mesh){scene.remove?.(mesh);mesh.geometry.dispose();mesh.material.dispose();mesh=null;}}};
}
