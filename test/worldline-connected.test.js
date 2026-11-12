import {test,expect} from 'bun:test';
import {contextLink,savedTime} from '../tools/worldline-connected.js';
test('navigation retains selected context and safely encodes entity IDs',()=>{
 const url=new URL(contextLink('/world',{experiment:'saved123',entityId:'person:a/b',time:'42',runId:'run:1',returnTo:'/tools/worldline.html'}),'https://example.test');
 expect(url.searchParams.get('entityId')).toBe('person:a/b');expect(url.searchParams.get('time')).toBe('42');expect(url.searchParams.get('experiment')).toBe('saved123');
});
test('checkpoint availability never fabricates a timeline',()=>{expect(savedTime({save:{checkpoint:{world:{t:17}}}})).toBe(17);expect(savedTime({})).toBeNull();});
