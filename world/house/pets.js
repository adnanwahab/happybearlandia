/** A household companion is a pet identity, never another population resident. */
export function householdPets(home){return [...(home?.pets??[]),...(home?.systems?.economy?.pets??[])].filter((pet,i,all)=>all.findIndex(p=>p.id===pet.id)===i);}
export function withHouseholdPet(home){
 if(home.pets!==undefined||householdPets(home).length)return home;
 let hash=2166136261;for(const ch of home.householdId)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
 const species=hash%2?'dog':'cat',names=species==='dog'?['Biscuit','Maple','Mochi','Scout','Sunny','Pepper']:['Clover','Miso','Luna','Olive','Pip','Willow'];
 return{...home,pets:[{id:home.householdId+'-pet-companion',species,name:names[Math.floor(hash/2)%names.length],roomId:home.rooms.find(r=>r.id==='living')?.id??home.rooms[0]?.id,source:'Household companion added to every home'}]};
}
export function validateHouseholdPets(home){if(home.pets===undefined)return;if(!Array.isArray(home.pets)||home.pets.length>2||new Set(home.pets.map(p=>p.id)).size!==home.pets.length||home.pets.some(p=>typeof p.id!=='string'||!p.id.startsWith(home.householdId+'-pet-')||!['dog','cat'].includes(p.species)||typeof p.name!=='string'||!p.name.trim()||p.name.length>30||!home.rooms.some(r=>r.id===p.roomId)))throw Error('Invalid household companion pet');}
