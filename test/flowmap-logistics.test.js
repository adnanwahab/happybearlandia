import {test,expect} from 'bun:test';
import {runLogistics,VERSION} from '../tools/flowmap/logistics.js';
const fixture=()=>({version:VERSION,context:{worldId:'world:test:one'},intervalHours:1,links:[{id:'link:test:a',from:'a',to:'b',hours:1,capacityPerHour:10,costPerUnit:2}],demands:[{id:'d',from:'a',to:'b',units:12}],roadMappings:[{roadId:'road:test:x',linkIds:['missing']}]});
test('capacity conserves volumes and records mapping and costs',async()=>{const r=await runLogistics(fixture());expect(r.deliveries[0]).toMatchObject({delivered:10,unserved:2,cost:20});expect(r.roadMappings[0].status).toBe('unconnected');expect(r).toEqual(await runLogistics(fixture()));});
test('closure blocks flow and changes hash',async()=>{const f=fixture(),a=await runLogistics(f);f.links[0].closed=true;const b=await runLogistics(f);expect(b.deliveries[0].unserved).toBe(12);expect(b.inputHash).not.toBe(a.inputHash);});
import { logisticsBusinessInputs } from '../tools/flowmap/business-connector.js';
test('business connector selects demand explicitly and converts hours to days',async()=>{
 const result=await runLogistics(fixture());
 const bridge=logisticsBusinessInputs(result,['d']);
 expect(bridge.externalInputs.deliveredSupplyFraction).toBe(10/12);
 expect(bridge.externalInputs.deliveryDelayDays).toBe(1/24);
 expect(()=>logisticsBusinessInputs(result,['unknown'])).toThrow();
});
