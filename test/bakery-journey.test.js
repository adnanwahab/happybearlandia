import {test,expect} from 'bun:test';
import {bakeryLogisticsInput,calculateBakeryTransport} from '../world/journeys/bakery-fixture.js';
import {runLogistics} from '../tools/flowmap/logistics.js';
test('Houston fixture closure calculates shortage and detour cost',async()=>{
 const open=await calculateBakeryTransport(),blocked=await calculateBakeryTransport({blocked:true});
 expect(open.result.deliveries[0]).toMatchObject({delivered:100,unserved:0,cost:100});
 expect(blocked.result.deliveries[0]).toMatchObject({delivered:40,unserved:60,cost:120});
 expect(open.result.inputHash).not.toBe(blocked.result.inputHash);
});
test('replay is deterministic and leaves parent immutable',async()=>{
 const parent=bakeryLogisticsInput(),snapshot=JSON.stringify(parent);
 const a=await runLogistics(parent),b=await runLogistics(parent);
 expect(a).toEqual(b);expect(JSON.stringify(parent)).toBe(snapshot);
});
test('unsupported interventions fail explicitly',async()=>{
 await expect(calculateBakeryTransport({wages:100})).rejects.toThrow('supported');
 await expect(calculateBakeryTransport({blocked:'yes'})).rejects.toThrow('supported');
});
