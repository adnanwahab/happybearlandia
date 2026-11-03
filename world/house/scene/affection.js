/** Pair placement is derived from actual action participant IDs and inventory.
 * No second person, consent or relationship is created by this adapter. */
export function affectionTarget(person,{room,objects}){const action=person.activeAction,ids=action?.participantIds,index=ids?.indexOf(person.id);if(!['hug','cuddle'].includes(action?.type)||ids?.length!==2||index<0)return null;const couch=objects.get(String(person.interaction?.objectId))??[...objects.values()].find(o=>o.record.type==='couch'&&o.record.roomId===person.roomId);
 if(action.type==='cuddle'){if(couch?.record.type!=='couch'||couch.seats.length<2)return null;const first=couch.seats[0],adjacent=couch.seats[1],other=Math.hypot(adjacent.x-first.x,adjacent.z-first.z)>=.65?adjacent:couch.seats.at(-1),seat=index===0?first:other;return{...seat,seat,pairIndex:index};}
 const anchorX=couch?couch.x+1.9*(couch.scale??1)+.75:room.x+.9,z=(couch?.z??room.z)+.25;return{x:anchorX+(index===0?-.3:.3),z,heading:index===0?Math.PI/2:-Math.PI/2,seat:null,pairIndex:index};
}
