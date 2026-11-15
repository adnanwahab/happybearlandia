/** Read-only cues from the existing synthetic Population pet records. */
export function petPresentation(pet,home={},minute){
 const needs=[['hunger','Food'],['energy','Rest'],['fun','Play'],['social','Affection']]
  .filter(([key])=>Number.isFinite(pet.needs?.[key]))
  .map(([key,label])=>({key,label,value:pet.needs[key]}));
 const action=(home.actions??[]).find(a=>a.systemData?.['pet-interaction']?.petId===pet.id);
 const kinds={petPet:'Petting',petTreat:'Treat',petPlay:'Play',petBrush:'Brushing'};
 const history=[...(Number.isFinite(pet.lastPettedMinute)?[{label:'Petting',minute:pet.lastPettedMinute}]:[]),
  ...Object.entries(pet.interactions??{}).map(([kind,row])=>({label:{treat:'Treat',play:'Play',brush:'Brushing'}[kind],minute:row.lastMinute}))]
  .filter(row=>row.label&&Number.isFinite(row.minute)&&(!Number.isFinite(minute)||row.minute<=minute)).sort((a,b)=>b.minute-a.minute)[0];
 const sleeping=pet.activity==='sleep'||pet.intent==='sleep';
 const low=needs.find(n=>n.value<45);
 const cue=action&&kinds[action.type]?kinds[action.type]+' requested · care completes after attended time':
  sleeping?'Resting':pet.activity==='eat'?'Eating':pet.activity==='play'?'Playing':low?low.label+' needs care':'Keeping company';
 return{needs,cue,sleeping,playing:pet.activity==='play'||action?.type==='petPlay',
  affection:action?.type==='petPet'||action?.type==='petBrush',
  text:[cue,...needs.map(n=>n.label+' '+Math.round(n.value)+'/100'),history?history.label+' completed at modeled minute '+history.minute:null].filter(Boolean).join(' · ')};
}
