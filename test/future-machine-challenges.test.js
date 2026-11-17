import {test,expect} from 'bun:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CityStore} from '../world/city/storage.js';
import {createCityApi} from '../world/city/api.js';
import {createExperiment,loadExperiment} from '../world/future-machine/data/index.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {QUESTIONS,createChallengeURL,parseChallengeURL,verifyChallengeHistory,MAX_CHALLENGE_LENGTH} from '../world/future-machine/share/challenges.js';
import {stateHash} from '../world/future-machine/data/core.js';

test('three editable questions restore exact persisted scenarios and selected outcomes',async()=>{
 const root=mkdtempSync(join(tmpdir(),'question-cards-')),store=new CityStore(root),handle=createCityApi({store}),realFetch=globalThis.fetch;
 globalThis.fetch=(path,options)=>handle(new Request(`http://localhost${path}`,options));
 try {
  const history=await createExperiment({...DEFAULT_RECIPE,households:3});
  for(const [i,prompt] of QUESTIONS.entries()) {
   const month=[0,16,120][i],question=i===1?'Which policy helps 🐻? <script>text only</script>':prompt;
   const url=await createChallengeURL(history,{question,month},'https://example.test/world/future-machine.html?renderer=canvas2d');
   expect(url.length).toBeLessThan(MAX_CHALLENGE_LENGTH);
   const challenge=await parseChallengeURL(url);
   expect(challenge.question).toBe(question);expect(challenge.month).toBe(month);
   const reopened=await loadExperiment(challenge.experimentId);
   await verifyChallengeHistory(reopened,challenge);
   expect(reopened.recipe).toEqual(history.recipe);
   const {identity,...recorded}=history.plan[month];
   expect(identity).toEqual({experimentId:history.experimentId,scenarioId:'plan',runIndex:0,runId:'plan-0'});
   // Receipt v1 covers recorded simulation fields; transport identity is
   // validated independently so existing shared challenges remain replayable.
   expect(challenge.receipt.outcomeDigests.plan.selected).toBe(await stateHash(recorded));
   expect(reopened).toEqual(history);
  }
  const url=await createChallengeURL(history,{question:QUESTIONS[0],month:16},'https://example.test/world/future-machine.html');
  const changed=new URL(url);changed.searchParams.set('month','17');
  await expect(parseChallengeURL(changed.href)).rejects.toThrow('context');
  const wrongIdentity=new URL(url);wrongIdentity.searchParams.set('experiment','city_other');
  await expect(parseChallengeURL(wrongIdentity.href)).rejects.toThrow('context');
  await expect(createChallengeURL({...history,experimentId:null},{question:QUESTIONS[0],month:0},url)).rejects.toThrow('saved experiment');
  const challenge=await parseChallengeURL(url);const altered=structuredClone(history);altered.plan[16].metrics.housingUnits++;
  await expect(verifyChallengeHistory(altered,challenge)).rejects.toThrow('does not match');
  const data=JSON.parse(decodeURIComponent(new URL(url).hash.slice(11)));data.receipt.checksum='0'.repeat(64);
  changed.searchParams.set('month','16');changed.hash='challenge='+encodeURIComponent(JSON.stringify(data));
  await expect(parseChallengeURL(changed.href)).rejects.toThrow('checksum');
  for(const question of ['', ' ', 'x'.repeat(201)])await expect(createChallengeURL(history,{question,month:0},url)).rejects.toThrow('question');
 } finally {globalThis.fetch=realFetch;store.close();rmSync(root,{recursive:true,force:true});}
},20000);
test('malformed or oversized challenge links fail explicitly',async()=>{
 expect(await parseChallengeURL('https://example.test/')).toBeNull();
 for(const fragment of ['%','null','{}',encodeURIComponent(JSON.stringify({version:'old'}))])await expect(parseChallengeURL('https://example.test/#challenge='+fragment)).rejects.toThrow();
 await expect(parseChallengeURL('https://example.test/#challenge='+'a'.repeat(MAX_CHALLENGE_LENGTH))).rejects.toThrow('too large');
});
