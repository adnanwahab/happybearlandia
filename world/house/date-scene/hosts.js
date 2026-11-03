import {projector} from '../../gen.js';
export const DATE_HOST_ARCHETYPES=Object.freeze({guide:{name:'Local guide',shirtColor:'#668cb9',hairColor:'#4b4035'},host:{name:'Venue host',shirtColor:'#a781a7',hairColor:'#634637'},artist:{name:'Street artist',shirtColor:'#5e9b83',hairColor:'#42374c'},musician:{name:'Street musician',shirtColor:'#b5755b',hairColor:'#2d3039'},memories:{name:'Memory keeper',shirtColor:'#c29857',hairColor:'#777064'}});
/** Fictional quest hosts stay separate from canonical date participants. Incoming
 * inspector IDs/availability are retained; placements are presentation only. */
export function dateSceneHosts(value={},world=null){
 const supplied=value.sceneHosts??value.date?.quests?.hosts??value.dates?.quests?.hosts;
 const defaults=Object.entries(DATE_HOST_ARCHETYPES).map(([id,row])=>({id,archetype:id,...row}));
 return (Array.isArray(supplied)?supplied:defaults).filter(h=>h&&h.id!=null&&h.visible!==false).slice(0,12).map((host,index)=>{
 const archetype=host.archetype??host.role??host.type??host.id,style=DATE_HOST_ARCHETYPES[archetype]??DATE_HOST_ARCHETYPES.guide;
 let anchor=(world?.places??[]).find(p=>p.id===(host.placeId??host.venueId))??host.place??world?.selectedPlace??{x:0,z:0};if(Number.isFinite(anchor.lat)&&Number.isFinite(anchor.lng)&&world?.origin){const [x,z]=projector(world.origin).toXZ(anchor.lat,anchor.lng);anchor={x,z};}
 let x=host.x??host.position?.x,z=host.z??host.position?.z;
 if(!Number.isFinite(x)||!Number.isFinite(z)){if(Number.isFinite(host.lat)&&Number.isFinite(host.lng)&&world?.origin)[x,z]=projector(world.origin).toXZ(host.lat,host.lng);else {const angle=index/Math.max(5,Array.isArray(supplied)?supplied.length:5)*Math.PI*2;x=(anchor.x??0)+Math.cos(angle)*6;z=(anchor.z??0)+Math.sin(angle)*6;}}
 return {...style,...host,id:String(host.id),name:host.name??host.label??style.name,archetype,x,z,fictional:true,populationMember:false,source:'Fictional date quest host; not a canonical population resident'};
 });
}
