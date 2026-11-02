import {test,expect} from '@playwright/test';
test('every NPC including the unsampled tail gets a SQLite journal and can read it through the character panel',async({page})=>{
 test.setTimeout(120000);await page.route('**/__character-journals-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><main></main>'}));await page.goto('/__character-journals-test');
 const result=await page.evaluate(async()=>{
  const {createPopulationRuntime}=await import('/world/population/runtime.js');const {createJournalRecorder,mountCharacterJournal}=await import('/world/journals/client.js');const {JOURNAL_CITIES}=await import('/world/journals/presets.js');
  const runtime=createPopulationRuntime({config:{population:650,seed:42},worldContext:{journalsEnabled:true},stepMinutes:15});window.journalRuntime=runtime;await runtime.ready;await runtime.stepToTime(900);
  const recorder=createJournalRecorder({city:JOURNAL_CITIES[0],mode:'living',getRunId:()=>runtime.getSnapshot().runtime.id,getMinute:()=>runtime.getSnapshot().minute,getPage:q=>runtime.getJournalPage(q)});await recorder.flush(true);
  const first=await runtime.inspectPerson(0),tail=first.id.replace(/p0$/,'p649');const person=await runtime.inspectPerson(tail);const saved=await recorder.read(tail);
  mountCharacterJournal(document.querySelector('main'),{personId:tail,recorder,current:person.journal,routine:'wake up · meals · work or school · errands · park · home'});
  return {tail,saved: saved.filter(r=>r.runId===runtime.getSnapshot().runtime.id),visible:runtime.getSnapshot().visibleAgents.length};
 });
 expect(result.visible).toBeLessThan(650);expect(result.saved).toHaveLength(1);expect(result.saved[0].personId).toBe(result.tail);expect(result.saved[0].text).toContain('slept');expect(result.saved[0].text).toContain('woke up');
 await page.getByRole('button',{name:'Read journal',exact:true}).click();await expect(page.locator('article').first()).toContainText('slept');
 await page.screenshot({path:'/private/tmp/hbl-character-journal.png'});await page.evaluate(()=>window.journalRuntime.destroy());
});

test('city legacy character inspector saves and opens its personal journal',async({page})=>{
 test.setTimeout(120000);await page.route('**/api/outcomes',r=>r.fulfill({json:{outcomes:[]}}));await page.route('**/api/overpass-health',r=>r.fulfill({json:{ok:true}}));
 await page.route('**/world/render.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nwindow.openJournalPerson=()=>{world.step(3);select({type:'person',id:0});};`});});
 await page.goto('/world?demo=1&people=10&renderer=webgl&quality=LOW&business_mode=true');await page.waitForFunction(()=>Boolean(window.openJournalPerson),null,{timeout:60000});await page.getByRole('button',{name:'Pause',exact:true}).click();await page.evaluate(()=>window.openJournalPerson());
 const inspector=page.locator('#inspect');await expect(inspector.getByRole('heading',{name:'Personal journal'})).toBeVisible();await inspector.getByRole('button',{name:'Read journal',exact:true}).click();await expect(inspector.locator('article').first()).toContainText('Day 1');await page.screenshot({path:'/private/tmp/hbl-city-character-journal.png'});
});
