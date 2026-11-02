import {test,expect} from 'bun:test';
import {citySpeaksCouncil,citySpeaksAnchor,citySpeaksFields} from '../world/city-speaks/panel.js';
test('council reports the actual bounded panel and withholds inconsistent or fabricated counts',()=>{
 expect(citySpeaksCouncil({panelSize:30,counts:{support:24,oppose:4,unsure:2}})).toMatchObject({available:true,n:30,supportShare:.8});
 expect(citySpeaksCouncil({panelSize:1000,counts:{support:24,oppose:4,unsure:2}}).available).toBe(false);
 expect(citySpeaksCouncil({panelSize:1001,counts:{support:1001,oppose:0,unsure:0}}).available).toBe(false);
 expect(citySpeaksCouncil(null).available).toBe(false);
});
test('Take me there uses supplied exact anchors or recorded housing assignment, never guessed business locations',()=>{
 expect(citySpeaksAnchor({id:'p',kind:'person',current:{x:3,z:7}})).toMatchObject({x:3,z:7});
 const comparison={state:{units:[{id:'u',buildingId:'b'}]},worldContext:{buildings:[{id:'b',center:[20,30]}]}};
 expect(citySpeaksAnchor({id:'h',kind:'household',current:{unitId:'u'}},comparison)).toMatchObject({x:20,z:30});
 expect(citySpeaksAnchor({id:'business',kind:'business',current:{districtId:'d'}},comparison)).toBeNull();
});
test('perspective fields use only real matched record values and exact field paths',()=>{
 const entity={baseline:{needs:{energy:40},budget:{housing:900},commuteMinutes:20},current:{needs:{energy:60},budget:{housing:950},commuteMinutes:25}},before=structuredClone(entity);
 expect(citySpeaksFields(entity)).toContainEqual({field:'needs.energy',baseline:40,current:60});
 expect(citySpeaksFields(entity)).toContainEqual({field:'budget.housing',baseline:900,current:950});
 expect(citySpeaksFields(entity).some(row=>row.field==='medicalErrand')).toBe(false);expect(entity).toEqual(before);
});
