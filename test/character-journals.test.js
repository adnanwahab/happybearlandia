import {test,expect} from 'bun:test';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCharacterJournalsHandler} from '../world/journals/api.js';
import {JOURNAL_CITIES,journalCity} from '../world/journals/presets.js';
import {ensureJournal,recordJournalInterval,journalPage,populationJournalPage} from '../world/journals/model.js';
import {createPopulationModel,stepPopulation,inspectPerson,serializePopulation,restorePopulation} from '../world/population/model.js';
import {createJournalRecorder} from '../world/journals/client.js';
test('scope exactly matches seven preset coordinates',()=>{expect(JOURNAL_CITIES).toHaveLength(7);const html=readFileSync(new URL('../world/index.html',import.meta.url),'utf8');const preset=html.match(/<select id="preset"[\s\S]*?<\/select>/)[0];for(const c of JOURNAL_CITIES)expect(preset).toContain(c.name);for(const c of JOURNAL_CITIES)expect(journalCity(c)).toBe(c);expect(journalCity({lat:0,lng:0})).toBeNull();});
test('actual intervals split at midnight, empty journals exist, and wake memories reflect sleep',()=>{const store={};ensureJournal(store,'a','A',0);expect(journalPage(store).entries[0].text).toBe('My day is just beginning.');recordJournalInterval(store,'a','A','SLEEP',1400,1450);recordJournalInterval(store,'a','A','BREAKFAST',1450,1470);const entries=journalPage(store).entries;expect(entries[0].activities.SLEEP).toBe(40);expect(entries[1].activities.SLEEP).toBe(10);expect(entries[1].text).toContain('woke up');});
test('SQLite persists every character, retries update one day, older snapshots cannot replace new entries, and cities/runs stay separate',async()=>{
 const root=mkdtempSync(join(tmpdir(),'hbl-journals-'));let api=createCharacterJournalsHandler({root});
 try{const store={};for(let i=0;i<23;i++)recordJournalInterval(store,String(i),`Resident ${i}`,'WORK',500,560);const batch={cityId:'gulfton',mode:'living',runId:'run-1',entries:journalPage(store).entries};const post=body=>api(new Request('http://local/api/character-journals',{method:'POST',body:JSON.stringify(body)}));
 expect((await post(batch)).status).toBe(200);expect((await post(batch)).status).toBe(200);api.close();api=createCharacterJournalsHandler({root});
 const read=async city=>(await(await api(new Request(`http://local/api/character-journals?city=${city}&mode=living&person=22`))).json()).entries;
 expect(await read('gulfton')).toHaveLength(1);expect((await read('gulfton'))[0].text).toContain('worked for 60 minutes');expect(await read('shibuya')).toHaveLength(0);
 const older={...batch,entries:[{...batch.entries[22],minute:550,text:'older'}]};await post(older);expect((await read('gulfton'))[0].text).not.toBe('older');
 await post({...batch,runId:'run-2'});expect(await read('gulfton')).toHaveLength(2);
 expect((await post({...batch,cityId:'outside-preset'})).status).toBe(400);expect((await post({...batch,entries:[{...batch.entries[0],day:-1}]})).status).toBe(400);
 }finally{api.close();rmSync(root,{recursive:true,force:true});}
});
test('journals cover all modeled people beyond render sample and restore with the model; routines move real people',()=>{
 const m=createPopulationModel({population:650,seed:42},{journalsEnabled:true,buildings:[{id:'home',kind:'home',center:[0,0]},{id:'work',kind:'work',center:[80,0]},{id:'park',kind:'park',center:[30,50]}]});
 let offset=0,total=0;do{const p=populationJournalPage(m,{offset,limit:500});total+=p.entries.length;offset=p.next;}while(offset!==null);expect(total).toBe(650);
 for(let t=1;t<=96;t++)stepPopulation(m,{tick:t,minutes:15});const entries=Object.values(m.journals),activities=new Set(entries.flatMap(e=>Object.keys(e.activities)));for(const activity of ['SLEEP','WORK','BREAKFAST','SHOPPING','RECREATION','TRANSIT'])expect(activities.has(activity)).toBe(true);
 expect(entries.some(e=>e.moments.some(m=>m.text.includes('usual routine')))).toBe(true);expect(entries.some(e=>e.moments.some(m=>m.text.includes('woke up')))).toBe(true);
 const restored=restorePopulation(serializePopulation(m));expect(populationJournalPage(restored,{limit:500})).toEqual(populationJournalPage(m,{limit:500}));expect(inspectPerson(m,649).journal).toBeDefined();
});
test('recorder saves all pages and retries failures without advancing its watermark',async()=>{let calls=0,fail=true;const statuses=[];const recorder=createJournalRecorder({city:JOURNAL_CITIES[0],mode:'living',getRunId:()=> 'run',getMinute:()=>60,getPage:async({offset})=>({entries:[{personId:String(offset)}],next:offset===0?500:null}),fetchImpl:async()=>{calls++;if(fail){fail=false;return Response.json({error:'offline'},{status:500});}return Response.json({saved:1});},onStatus:s=>statuses.push(s)});await recorder.flush(true);await recorder.flush(true);expect(calls).toBe(3);expect(statuses[0]).toContain('pending');expect(statuses[1]).toContain('saved');recorder.destroy();});
