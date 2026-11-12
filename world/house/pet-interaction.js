import {householdPets} from './pets.js';
import {recordEvent} from '../population/contracts.js';
export const PET_INTERACTIONS=Object.freeze([
 {kind:'pet',type:'petPet',label:'Pet cat',durationMinutes:15,minAge:1,mechanism:'Spend time petting your cat.',social:15,fun:6},
 {kind:'treat',type:'petTreat',label:'Feed a treat',durationMinutes:5,minAge:5,mechanism:'Give your cat a small treat.',social:5,fun:3},
 {kind:'play',type:'petPlay',label:'Play with cat',durationMinutes:15,minAge:5,mechanism:'Play together to build connection and fun.',social:12,fun:15},
 {kind:'brush',type:'petBrush',label:'Brush cat',durationMinutes:10,minAge:5,mechanism:'Gently brush your cat and spend time together.',social:10,fun:4},
]);
const interaction=type=>PET_INTERACTIONS.find(row=>row.type===type);
export function createPetInteractionSystem(){return{
 id:'pet-interaction',
 actions:Object.fromEntries(PET_INTERACTIONS.map(row=>[row.type,{label:row.label,durationMinutes:row.durationMinutes,minAge:row.minAge,roomId:'living',mechanism:row.mechanism}])),
 command(m,home,input,context){
  const choice=PET_INTERACTIONS.find(row=>row.kind===input.type);
  if(!choice||Object.keys(input).some(k=>!['type','personId','petId'].includes(k)))throw Error('Choose a household pet action');
  const pet=householdPets(home).find(p=>p.id===input.petId);if(!pet)throw Error('Choose an actual household pet');
  return context.startAction({type:choice.type,personId:input.personId,roomId:pet.roomId??'living',systemOptions:{petId:pet.id}});
 },
 actionPlan(m,home,request){
  if(!interaction(request.type))return;
  const pet=householdPets(home).find(p=>p.id===request.systemOptions?.petId);
  if(!pet)return{available:false,reason:'Choose an actual household pet'};
  if(request.roomId!==(pet.roomId??'living'))return{available:false,reason:'Meet the pet in its room'};
  if(home.actions.some(a=>interaction(a.type)&&a.systemData?.['pet-interaction']?.petId===pet.id))return{available:false,reason:'This pet is already spending time with someone'};
  return{available:true,data:{petId:pet.id}};
 },
 needRates(m,home,action,i,minute,activity,rates){const choice=interaction(action?.type);return choice?{...rates,social:.13,fun:choice.kind==='play'?.2:.08,comfort:.06}:rates;},
 completeAction(m,home,action,minute){
  const choice=interaction(action.type);if(!choice)return;
  const pet=householdPets(home).find(p=>p.id===action.systemData?.['pet-interaction']?.petId);if(!pet)return;
  if(choice.kind==='pet'){pet.lastPettedMinute=minute;pet.pettingMinutes=(pet.pettingMinutes??0)+action.durationMinutes;}
  else{pet.interactions??={};const history=pet.interactions[choice.kind]??{count:0,minutes:0};pet.interactions[choice.kind]={count:history.count+1,minutes:history.minutes+action.durationMinutes,lastMinute:minute};}
  if(pet.needs){pet.needs.social=Math.min(100,(pet.needs.social??0)+choice.social);if(choice.kind==='treat')pet.needs.hunger=Math.min(100,(pet.needs.hunger??0)+10);if(choice.kind==='play')pet.needs.fun=Math.min(100,(pet.needs.fun??0)+choice.fun);}
  recordEvent(m,choice.kind==='pet'?'HOUSE_PET_PETTED':'HOUSE_PET_'+choice.kind.toUpperCase(),{householdId:home.householdId,petId:pet.id,personId:m.prefix+'-p'+action.participants[0],minute,reason:choice.label+' with '+pet.name});
 },
 inspect(m,home){return{pets:structuredClone(householdPets(home))};},
 validate(m,home){for(const pet of householdPets(home)){
  if(pet.pettingMinutes!==undefined&&(!Number.isFinite(pet.pettingMinutes)||pet.pettingMinutes<0||!Number.isFinite(pet.lastPettedMinute)||pet.lastPettedMinute>m.minute))throw Error('Invalid saved petting history');
  for(const [kind,row]of Object.entries(pet.interactions??{}))if(!PET_INTERACTIONS.some(choice=>choice.kind===kind)||!Number.isSafeInteger(row.count)||row.count<1||!Number.isFinite(row.minutes)||row.minutes<=0||!Number.isFinite(row.lastMinute)||row.lastMinute>m.minute)throw Error('Invalid saved pet interaction history');
 }return true;},
};}
