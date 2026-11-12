/** Cosmetic cues from completed, attended evening evidence only. */
export function createEveningReactionTracker(){
 const episodes=new Map();
 return{update(home){const evening=home?.systems?.evening?.active;if(!evening?.id)return[];const evidence=Array.isArray(evening.evidence)?evening.evidence:[];
  let seen=episodes.get(evening.id);if(!seen){seen=new Set(evidence.map(item=>item.actionId));episodes.set(evening.id,seen);if(episodes.size>32)episodes.delete(episodes.keys().next().value);return[];}
  const reaction=evening.lastReaction,item=evidence.find(item=>item.actionId===reaction?.sourceActionId);if(!item||seen.has(item.actionId)||reaction.status!=='completed'||reaction.awaitingRelationshipOutcome)return[];
  const ids=item.personIds;if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||!ids.every(id=>typeof id==='string')||!(item.durationMinutes>0)||!(item.attendedPersonMinutes>=item.durationMinutes*ids.length-1e-6))return[];
  seen.add(item.actionId);const outcome=reaction.relationshipEvent??item.relationshipEvent;let kind='turn-toward';if(outcome==='reconciliation')kind='relieved';else if(item.exchangeKind==='joke'&&['shared-interest','reconnected','conversation'].includes(outcome))kind='laugh';else if(['argument','awkward-conversation'].includes(outcome))kind='look-away';
  return[{id:evening.id+':'+item.actionId,actionId:item.actionId,episodeId:evening.id,personIds:[...ids],kind,text:String(reaction.text??''),source:'Completed attended evening interaction',durationSeconds:2.4}];
 }};
}
export function applyEveningReaction(actor,cue,elapsed,actors){if(!cue||elapsed<0||elapsed>=cue.durationSeconds||!['idle','talk','rest','sit','tv','read'].includes(actor.visualPose??actor.pose))return false;
 const strength=Math.sin(Math.PI*elapsed/cue.durationSeconds),head=actor.root.getObjectByName('Head pivot'),torso=actor.root.getObjectByName('Upper body pivot'),left=actor.root.getObjectByName('Left arm'),right=actor.root.getObjectByName('Right arm');
 if(cue.kind==='laugh'){if(torso)torso.rotation.x-=Math.abs(Math.sin(elapsed*10))*.11*strength;if(head)head.rotation.x-=.12*strength;if(left)left.rotation.x-=.2*strength;if(right)right.rotation.x-=.2*strength;}
 else if(cue.kind==='relieved'){if(torso)torso.rotation.x-=.045*strength;if(head)head.rotation.x-=.09*strength;}
 else if(cue.kind==='look-away'){if(head)head.rotation.y+=.35*strength;}
 else{const partner=cue.personIds.map(id=>actors.get(id)).find(other=>other&&other!==actor);if(partner&&head){const delta=Math.atan2(partner.root.position.x-actor.root.position.x,partner.root.position.z-actor.root.position.z)-actor.root.rotation.y,angle=Math.atan2(Math.sin(delta),Math.cos(delta));head.rotation.y+=Math.max(-.55,Math.min(.55,angle))*strength;}}
 return true;
}
