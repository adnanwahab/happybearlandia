import {test,expect} from 'bun:test';
import {createPopulationModel,stepPopulation,serializePopulation,restorePopulation,inspectHousehold} from '../world/population/model.js';
import {configureHouseLife,applyHouseholdAction} from '../world/house/model.js';
import {residentEventDialogue,renderResidentEventDialogue} from '../world/house/event-dialogue.js';
function run(){
 const model=createPopulationModel({population:8,householdSize:4,seed:42},{},{initialMinute:1080,initialTick:1080}),householdId=model.prefix+'-h0';
 configureHouseLife(model,{householdId,autonomy:false});
 for(let i=0;i<4;i++){model.people.ageYears[i]=30;model.people.current[i]=model.people.home[i];model.people.x[i]=model.people.homeX[i];model.people.z[i]=model.people.homeZ[i];model.people.remaining[i]=0;model.people.employed[i]=0;}
 const action=applyHouseholdAction(model,{householdId,personId:model.prefix+'-p0',type:'rest'});
 for(let i=0;i<120&&!model.houses.homes[0].completedActions.some(a=>a.id===action.actionId);i++)stepPopulation(model,{minutes:1});
 return model;
}
function input(model){const home=inspectHousehold(model,0).house;return{events:home.systems.story.events,members:home.members,minute:model.minute};}
function assertReferences(lines,events){for(const line of lines){expect(typeof line.eventId).toBe('string');expect(events.filter(event=>event.id===line.eventId)).toHaveLength(1);}}
test('seed 42 completed actions yield event-referenced resident lines and replay identically',()=>{
 const model=run(),data=input(model),lines=residentEventDialogue(data);
 expect(lines.length).toBeGreaterThan(0);assertReferences(lines,data.events);
 expect(residentEventDialogue(input(run()))).toEqual(lines);
 expect(residentEventDialogue(input(restorePopulation(serializePopulation(model))))).toEqual(lines);
 expect(()=>assertReferences([{text:'uncited'}],data.events)).toThrow();
});
test('missing, blank, duplicate, expired, future and unknown participant evidence suppresses dialogue',()=>{
 const data=input(run()),event=data.events.find(e=>e.personIds?.length),base={...data,events:[event]};
 expect(residentEventDialogue(base)).toHaveLength(1);
 for(const events of [[],[{...event,id:undefined}],[{...event,id:''}],[{...event,id:' '}],[event,{...event}],[{...event,minute:data.minute+1}],[{...event,personIds:['absent']}],[{...event,text:''}]])expect(residentEventDialogue({...base,events})).toEqual([]);
});

test('renderer attaches every displayed line to its exact retained event and removes uncited records',()=>{
 // A recording DOM exercises the production render boundary without a browser.
 const doc={createElement(tag){return{tag,dataset:{},children:[],append(...nodes){this.children.push(...nodes);}};}};
 const host={ownerDocument:doc,children:[],querySelectorAll(){return[];},replaceChildren(){this.children=[];},append(node){this.children.push(node);}};
 const data=input(run());renderResidentEventDialogue(host,data);
 const details=host.children.filter(node=>node.tag==='details');expect(details.length).toBeGreaterThan(0);
 for(const detail of details){const [line,source]=detail.children;assertReferences([{eventId:line.dataset.dialogueEventId}],data.events);expect(source.dataset.dialogueSourceId).toBe(line.dataset.dialogueEventId);const event=data.events.find(e=>e.id===line.dataset.dialogueEventId);expect(source.textContent).toContain(event.text);}
 renderResidentEventDialogue(host,{...data,events:data.events.map(({id,...event})=>event)});
 expect(host.children).toEqual([]);
});
