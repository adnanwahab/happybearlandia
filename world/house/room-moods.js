/** Cosmetic preferences only: no simulation objects or commands are accepted. */
export const ROOM_MOODS=Object.freeze({default:{label:'Default',color:'#ffffff',intensity:0,sound:null},cozy:{label:'Cozy',color:'#ffbc72',intensity:9,sound:'sfx_002'},lively:{label:'Lively',color:'#ffc9e6',intensity:12,sound:'sfx_015'},quiet:{label:'Quiet',color:'#a9caff',intensity:5,sound:null}});
export function createRoomMoods(storage,key){
 let values=Object.create(null);try{const saved=JSON.parse(storage?.getItem(key));if(saved?.version===1&&saved.rooms&&typeof saved.rooms==='object')for(const [id,mood]of Object.entries(saved.rooms).slice(0,128))if(Object.hasOwn(ROOM_MOODS,mood)&&mood!=='default')values[id]=mood;}catch{}
 const get=id=>Object.hasOwn(values,String(id))?values[String(id)]:'default';
 const save=()=>{try{storage?.setItem(key,JSON.stringify({version:1,rooms:values}));return true;}catch{return false;}};
 return{get,set(id,mood,roomIds){if(!roomIds.map(String).includes(String(id))||!Object.hasOwn(ROOM_MOODS,mood))return{accepted:false,persisted:false};if(mood==='default')delete values[String(id)];else values[String(id)]=mood;return{accepted:true,persisted:save()};},reset(){values=Object.create(null);return save();}};
}
/** Bounded static non-shadow lights. No animation, shader pass or RNG. */
export function applyRoomMoodLights(THREE,scene,rooms,get){const lights=[];for(const [id,room]of [...rooms].slice(0,12)){const mood=ROOM_MOODS[get(id)]??ROOM_MOODS.default;if(!mood.intensity)continue;const light=new THREE.PointLight(mood.color,mood.intensity,Math.max(room.w??6,room.d??6)*.85,2);light.position.set(room.x,2,room.z);scene.add(light);lights.push(light);}return()=>{for(const light of lights){light.removeFromParent();light.dispose?.();}};}
