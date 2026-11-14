import {test,expect} from 'bun:test';
import {civicProviderUrl,civicPublishUrl} from '../ops/civic-provider.js';
test('public civic reads use the actual deployed service by default',()=>{
 expect(civicProviderUrl()).toBe('https://civic-synthesis.fly.dev/api');
 expect(new URL('outcomes',civicProviderUrl()+'/').href).toBe('https://civic-synthesis.fly.dev/api/outcomes');
});
test('explicit operator routing remains unchanged, including local fixtures',()=>{
 for(const url of ['http://127.0.0.1:4399/api','https://example.org/custom/api/'])expect(civicProviderUrl({DEAR_CONGRESS_URL:url})).toBe(url);
 expect(civicProviderUrl({DEAR_CONGRESS_URL:''})).toBe(civicProviderUrl());
});

test('read-default migration never silently enables or redirects journal publishing',()=>{expect(civicPublishUrl()).toBeNull();expect(civicPublishUrl({DEAR_CONGRESS_URL:'http://127.0.0.1:4399/api'})).toBe('http://127.0.0.1:4399/api');});

test('retired production hostname migrates reads but not explicitly routed publishing',()=>{const env={DEAR_CONGRESS_URL:'https://dear-congress.fly.dev/api'};expect(civicProviderUrl(env)).toBe('https://civic-synthesis.fly.dev/api');expect(civicPublishUrl(env)).toBe(env.DEAR_CONGRESS_URL);});
