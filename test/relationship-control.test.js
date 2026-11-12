import {test,expect} from 'bun:test';
import {createPopulationModel,serializePopulation,restorePopulation} from '../world/population/model.js';
import {applyHouseholdSystemCommand} from '../world/house/system-command.js';
import {inspectHouseRelationships} from '../world/house/relationships.js';
test('away partners can end and mutually restart a relationship with persistent history',()=>{
 let m=createPopulationModel({population:8,householdSize:4,seed:42},{},{initialMinute:360,initialTick:360});const a=m.prefix+'-p0',b=m.prefix+'-p4',key=JSON.stringify([a,b].sort());m.people.ageYears[0]=30;m.people.ageYears[4]=30;m.social??={};m.social.ties??={};m.social.ties[key]={a,b,kind:'Met',friendship:50,romance:100,tension:0,familiarity:40,dating:true,memories:[]};const cmd=(type,id,extra={})=>applyHouseholdSystemCommand(m,{householdId:m.prefix+'-h0',system:'relationship-control',type,personId:a,targetId:b,commandId:id,...extra});
 cmd('end','end1');expect(m.social.ties[key].dating).toBe(false);expect(m.social.ties[key].romance).toBe(0);expect(inspectHouseRelationships(m,a).relationships.find(r=>r.personId===b).previouslyDated).toBe(true);cmd('end','end1');expect(m.social.ties[key].memories).toHaveLength(1);
 expect(()=>cmd('reunite','back1')).toThrow('Both Sims must agree');cmd('reunite','back1',{consentingPersonIds:[a,b]});expect(m.social.ties[key].dating).toBe(true);expect(m.social.ties[key].romance).toBe(0);expect(m.social.ties[key].memories).toHaveLength(2);m=restorePopulation(serializePopulation(m));expect(m.social.ties[key].commitment.status).toBe('dating');
});
