import {test,expect} from 'bun:test';
import {petPresentation} from '../world/house/pet-presentation.js';
test('companions never acquire invented needs and projection is read only',()=>{
 const pet={id:'cat',name:'Miso'},home={actions:[]},before=JSON.stringify({pet,home});
 expect(petPresentation(pet,home,10).needs).toEqual([]);
 expect(petPresentation(pet,home,10).text).toBe('Keeping company');
 expect(JSON.stringify({pet,home})).toBe(before);
});
test('finite need cues, rest and actual activity are distinguished',()=>{
 const pet={needs:{hunger:20,energy:80,fun:NaN,social:undefined}};
 expect(petPresentation(pet).text).toBe('Food needs care · Food 20/100 · Rest 80/100');
 expect(petPresentation({...pet,activity:'sleep'}).sleeping).toBe(true);
 expect(petPresentation({...pet,activity:'play'}).playing).toBe(true);
});
test('requests target exact identity and completion uses saved history and model minute',()=>{
 const pet={id:'cat',interactions:{treat:{lastMinute:20}}};
 const home={actions:[{type:'petPlay',systemData:{'pet-interaction':{petId:'other'}}}]};
 expect(petPresentation(pet,home,19).text).toBe('Keeping company');
 home.actions[0].systemData['pet-interaction'].petId='cat';
 expect(petPresentation(pet,home,20).text).toContain('Play requested');
 expect(petPresentation(pet,home,20).text).toContain('Treat completed at modeled minute 20');
 home.actions=[];
 expect(petPresentation(pet,home,20).playing).toBe(false);
});
