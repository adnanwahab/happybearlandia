import {test,expect} from 'bun:test';
import {sameOriginRouteURL} from './support/startup-route-link.js';
const base='http://127.0.0.1:41973/';
test('route matching retains universe context and fragments instead of requiring a literal href',()=>{
 const href='/world?universeId=universe%3Ahbl%3Amain&worldId=world%3Ahbl%3Amain&scenarioId=scenario%3Ahbl%3Abaseline#resident';
 expect(sameOriginRouteURL(href,base,'/world')).toBe(base.slice(0,-1)+href);
 expect(sameOriginRouteURL('/tools/simulation-health?worldId=main#ready',base,'/tools/simulation-health')).toBe(base+'tools/simulation-health?worldId=main#ready');
});
test('route matching rejects neighboring paths, foreign origins, malformed and absent hrefs',()=>{
 for(const href of ['/worldline','/world/house','/world/','https://example.test/world','http://127.0.0.1:3000/world','//elsewhere.test/world','javascript:alert(1)','http://[invalid',null,''])expect(sameOriginRouteURL(href,base,'/world')).toBeNull();
 expect(sameOriginRouteURL('world',base,'/world')).toBe(base+'world');
});
