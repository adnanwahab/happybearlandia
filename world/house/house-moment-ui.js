/** Presentation of actual needs and queues; suggestions never claim to be scheduled. */
export function urgentHouseNeed(person){
 const needs=person?.needs??{},options=[['energy','Exhausted',['sleep','rest']],['hunger','Hungry',['eat','cook']],['bladder','Needs the bathroom',['toilet','useToilet']],['hygiene','Needs a wash',['shower','washHands']],['social','Needs company',['conversation']],['comfort','Uncomfortable',['rest','sit']],['fun','Needs a break',['music','read','watchTV']]];
 const low=options.filter(([key])=>Number.isFinite(needs[key])&&needs[key]<30).sort((a,b)=>needs[a[0]]-needs[b[0]])[0];return low?{key:low[0],label:low[1],value:needs[low[0]],actions:low[2]}:null;
}
export function householdWants(data,personId){const story=data.story??data.home?.systems?.story;const person=story?.members?.find(p=>(p.personId??p.id)===personId);if(person)return{label:'Immediate wants',wants:person.wants??[]};const life=data.home?.life?.members?.find(p=>(p.personId??p.id)===personId);return{label:'Immediate wants',wants:life?.wants??[]};}
export function residentProfilePatch(values){
 const result={};for(const [key,value]of Object.entries(values)){
  if(['shirtColor','skinColor','hairColor'].includes(key)){if(!/^#[0-9a-f]{6}$/i.test(value))throw Error('Choose a valid appearance color.');result[key]=value;continue;}
  const max=key==='name'?50:120;if(!['name','favoriteActivity','concern','aspiration'].includes(key)||typeof value!=='string'||value.trim().length>max||(key==='name'&&!value.trim()))throw Error('Use a name of 1–50 characters and personal notes of at most 120 characters.');result[key]=value.trim();
 }return result;
}
export function mountResidentProfileEditor(host,{person,onCommand}={}){
 const doc=host.ownerDocument,root=doc.createElement('details');root.dataset.residentProfileEditor=person.id??person.personId;const summary=doc.createElement('summary');summary.textContent='Edit resident';root.append(summary);const form=doc.createElement('form');root.append(form);const fields=new Map(),initial=new Map();let dirty=false,pending=false;
 const profile=person.profile??person;
 for(const [key,label]of [['name','Name'],['favoriteActivity','Favorite activity'],['concern','Current concern'],['aspiration','Personal aspiration'],['shirtColor','Clothing color'],['skinColor','Skin color'],['hairColor','Hair color']]){
  const wrap=doc.createElement('label'),input=doc.createElement('input');wrap.textContent=label+' ';input.name=key;input.setAttribute('aria-label',label);const color=key.endsWith('Color');input.type=color?'color':'text';input.maxLength=key==='name'?50:120;const value=profile[key]??person[key];input.value=color?(value??'#808080'):(value??'');initial.set(key,input.value);input.addEventListener('input',()=>{dirty=true;root.dataset.dirty='true';});wrap.append(input);form.append(wrap);fields.set(key,input);
 }
 const save=doc.createElement('button');save.type='submit';save.textContent='Save resident';save.disabled=!onCommand;form.append(save);const status=doc.createElement('p');status.setAttribute('role','status');if(!onCommand)status.textContent='Resident editing is not connected in this view.';form.append(status);
 form.addEventListener('submit',async event=>{event.preventDefault();if(!onCommand||pending)return;try{const changed=Object.fromEntries([...fields].filter(([key,input])=>input.value!==initial.get(key)).map(([key,input])=>[key,input.value]));const patch=residentProfilePatch(changed);if(!Object.keys(patch).length){status.textContent='No changes to save.';return;}pending=true;save.disabled=true;status.textContent='Saving resident…';const result=await onCommand({personId:person.id??person.personId,patch});if(result?.accepted!==true)throw Error(result?.reason??'The profile change was not acknowledged.');for(const [key,input]of fields)initial.set(key,input.value);dirty=false;delete root.dataset.dirty;status.textContent='Resident saved.';}catch(error){status.textContent=error.message;}finally{pending=false;save.disabled=!onCommand;}});
 host.append(root);return{root,get editing(){return dirty||pending||root.contains(doc.activeElement);}};
}
