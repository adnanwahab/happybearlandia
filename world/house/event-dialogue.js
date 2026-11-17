// Scripted presentation of retained House/Population checkpoint records.
// Event IDs are scoped to the inspected household's Story log.
export function residentEventDialogue({events=[],members=[],minute}={}) {
 const counts=new Map();
 for(const event of events)if(typeof event?.id==='string'&&event.id.trim())counts.set(event.id,(counts.get(event.id)??0)+1);
 const people=new Map(members.map(person=>[person.id??person.personId,person]));
 return events.filter(event=>counts.get(event?.id)===1&&Number.isFinite(event.minute)&&event.minute<=minute&&typeof event.text==='string'&&event.text.trim()&&Array.isArray(event.personIds))
  .flatMap(event=>{const personId=event.personIds.find(id=>people.has(id));if(!personId)return[];const person=people.get(personId);return[{eventId:event.id,personId,speaker:person.name??personId,text:'I remember this: '+event.text}];}).slice(-3).reverse();
}

export function renderResidentEventDialogue(container,input) {
 const doc=container.ownerDocument;
 const expanded=new Set([...container.querySelectorAll('details[open] summary')].map(node=>node.dataset.dialogueEventId));
 container.replaceChildren();
 const lines=residentEventDialogue(input);
 if(!lines.length)return;
 const heading=doc.createElement('h3');heading.textContent='Resident recollections';container.append(heading);
 const note=doc.createElement('p');note.textContent='Scripted recollections of synthetic recorded events. Select a line to inspect its source.';container.append(note);
 for(const line of lines){
  // Resolve again at the display boundary. Never render an orphaned citation.
  const matches=input.events.filter(event=>event.id===line.eventId);
  if(matches.length!==1)continue;
  const event=matches[0],details=doc.createElement('details'),summary=doc.createElement('summary'),source=doc.createElement('p');
  details.open=expanded.has(line.eventId);
  summary.dataset.dialogueEventId=line.eventId;summary.dataset.dialoguePersonId=line.personId;
  summary.textContent=line.speaker+': '+line.text+' · Event '+line.eventId;
  source.dataset.dialogueSourceId=event.id;
  source.textContent='Recorded event '+event.id+' · Minute '+event.minute+' · '+event.type+' · '+event.text;
  details.append(summary,source);container.append(details);
 }
}
