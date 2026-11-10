/** A household companion is a pet identity, never another population resident. */
export function householdPets(home){return [...(home?.pets??[]),...(home?.systems?.economy?.pets??[])].filter((pet,i,all)=>all.findIndex(p=>p.id===pet.id)===i);}
export function withHouseholdPet(home){
 if(householdPets(home).some(pet=>pet.species==='cat'))return home;
 // Upgrade the original generated companion in place, retaining its saved history.
 const companionId=home.householdId+'-pet-companion',companion=(home.pets??[]).find(pet=>pet.id===companionId);
 if(companion)return{...home,pets:home.pets.map(pet=>pet.id===companionId?{...pet,species:'cat'}:pet)};
 let hash=2166136261;for(const ch of home.householdId)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
 const names=['Clover','Miso','Luna','Olive','Pip','Willow'];
 return{...home,pets:[...(home.pets??[]),{id:companionId,species:'cat',name:names[Math.floor(hash/2)%names.length],roomId:home.rooms.find(r=>r.id==='living')?.id??home.rooms[0]?.id,source:'Household companion added to every home'}]};
}
export function validateHouseholdPets(home){if(home.pets===undefined)return;if(!Array.isArray(home.pets)||home.pets.length>3||new Set(home.pets.map(p=>p.id)).size!==home.pets.length||home.pets.some(p=>typeof p.id!=='string'||!p.id.startsWith(home.householdId+'-pet-')||!['dog','cat'].includes(p.species)||typeof p.name!=='string'||!p.name.trim()||p.name.length>30||!home.rooms.some(r=>r.id===p.roomId)))throw Error('Invalid household companion pet');}
