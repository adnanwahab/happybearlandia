const when=n=>'Day '+(Math.floor(n/1440)+1);
export function renderNeighborHelp({body,s,el,select,button,send,onVisitors}){
 el('h3','A little help from a neighbor',body);el('p','Post an actual household need or volunteer at a saved nearby home. Helpers walk to the door, need permission to enter, and earn friendship only when the real task finishes.',body);
 if(!s){el('p','The help board is loading.',body);return;}
 if(onVisitors)button('Visitors and invitations',onVisitors,body);
 const actor=select('Help board resident',s.people.map(p=>[p.personId,p.name+(p.atHome?'':' · away')]),body);el('h4','Ask for help at this home',body);
 if(!s.needs.length)el('p','No plant-care, broken-object, or baby-meal requests to post right now.',body);
 for(const need of s.needs)button('Ask a neighbor: '+need.label,()=>send({type:'post',personId:actor.value,kind:need.kind,objectId:need.objectId}),body,!actor.value);
 el('h4','The neighborhood board',body);if(!s.board.length)el('p','Requests from nearby saved homes will appear here.',body);
 for(const r of s.board){const card=el('article',null,body);card.dataset.neighborHelp=r.id;el('h4',r.title,card);el('p',r.requesterName+' · '+(r.own?'this home':Math.round(r.distanceM)+'m away')+' · '+r.status,card);el('small','Posted '+when(r.createdMinute)+' · expires '+when(r.expiresMinute),card);
  if(r.volunteerName)el('p',r.volunteerName+' volunteered'+(r.visitPhase?' · '+r.visitPhase:'')+'.',card);
  if(r.status==='open'&&r.own)for(const c of r.candidates??[]){button('Ask '+c.name+' to volunteer',()=>send({type:'volunteer',requestId:r.id,personId:c.personId}),card,!c.available);if(c.reason)el('small',c.name+' · '+c.reason,card);}
  if(r.status==='open'&&!r.own)button('Volunteer for '+r.title.toLowerCase(),()=>send({type:'volunteer',requestId:r.id,personId:actor.value}),card,!actor.value);
  if(r.status==='open'&&r.own&&!r.candidates?.length)el('p','Invite a neighbor, or open another nearby home, to find someone who can help.',card);
  if(r.status==='assigned'){
   if(r.visitPhase==='waiting')button('Welcome volunteer into requesting home',()=>send({type:'admit',requestId:r.id,personId:r.requesterId}),card);
   if(r.admitted)button('Ask '+r.volunteerName+' to do the task',()=>send({type:'work',requestId:r.id,personId:r.volunteerId}),card);
   else el('small','The task starts after the volunteer reaches the door and is welcomed inside. Press Play to let them walk.',card);
   button('Withdraw volunteer',()=>send({type:'withdraw',requestId:r.id,personId:r.volunteerId}),card);
  }
  if(r.status==='working')el('p','Help is underway. Press Play to finish the real household activity.',card);
  if(r.own&&['open','assigned'].includes(r.status))button('Take down request',()=>send({type:'cancel',requestId:r.id,personId:r.requesterId}),card);
  if(r.status==='completed'){el('p','Thank you, '+r.volunteerName+'. The completed help is remembered by both neighbors.',card);const details=el('details',null,card);el('summary','What was actually done',details);el('small','Completed '+when(r.completedMinute)+' · '+r.actionId+(r.servings?' · '+r.servings+' real servings cooked':''),details);}
  if(r.status==='resolved')el('p','The household no longer needs this task. The request closed without a friendship reward.',card);
 }
}
