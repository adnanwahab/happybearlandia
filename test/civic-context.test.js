import {test,expect} from 'bun:test';
import {parseCivicContext,civicContextLink} from '../world/laws/civic-context.js';
const recipe={civicContext:'1',proposalId:'demo-law-83',revision:2,lawId:83,implementationStrength:.5,seed:42,population:24,modelVersion:'population.v1'};
test('public context round-trips only allowlisted fields to fixed destinations',()=>{
 for(const destination of ['hbl','civic']){
  const url=new URL(civicContextLink({...recipe,email:'private@example.org',token:'secret',redirect:'https://evil.example'},destination));
  expect(parseCivicContext(url.search)).toEqual(recipe);
  expect(url.hostname).toBe(destination==='hbl'?'happybearlandia.fly.dev':'civic-synthesis.fly.dev');
  expect(url.search).not.toContain('private');expect(url.search).not.toContain('secret');expect(url.search).not.toContain('evil');
 }
});
test('malformed, duplicate, unsupported and unversioned imports fail closed',()=>{
 for(const patch of [{civicContext:'2'},{lawId:31},{lawId:21,implementationStrength:.5},{seed:-1},{seed:4294967296},{population:25},{implementationStrength:.1},{revision:0},{revision:1000001},{proposalId:'private person@example.com'},{modelVersion:'<script>'},{seed:''}]){
  expect(parseCivicContext(new URLSearchParams({...recipe,...patch}))).toBeNull();
 }
 const p=new URLSearchParams(recipe);p.append('lawId','22');expect(parseCivicContext(p)).toBeNull();
 expect(parseCivicContext('')).toBeNull();
});
test('fixed upzoning and seed boundaries remain explicit',()=>{
 expect(parseCivicContext(new URLSearchParams({...recipe,lawId:21,implementationStrength:1,seed:0})).seed).toBe(0);
 expect(parseCivicContext(new URLSearchParams({...recipe,seed:4294967295})).seed).toBe(4294967295);
});
