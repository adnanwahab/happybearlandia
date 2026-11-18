import {test,expect} from '@playwright/test';

/* The Life Story panel inside the real launch shell, driven by the real legacy
 * World model running in the page. The 3D renderer is replaced by this small
 * host so the journey runs without a GPU; the host methods mirror render.js. */
const fixture=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Life Story fixture</title>
<link rel="stylesheet" href="/world/launch-shell.css"><style>body{margin:0;min-height:100vh;background:radial-gradient(circle at 40% 30%,#3a4a5c,#151b23)}</style></head>
<body><div id="view"></div><script type="module">
import {buildTown} from '/world/gen.js';
import {createWorld} from '/world/sim.js';
import {readLegacyLifeStorySource,commandLegacyResident} from '/world/stories/legacy-source.js';
const world=createWorld(buildTown({lat:29.7286,lng:-95.4746},null,{maxPeople:40}),{recordHistory:true});
world.step(240);
let selected=null;const listeners=new Set();
window.hblWorldActivity={
 async getLifeStorySource(id){return readLegacyLifeStorySource({world,id});},
 async commandResident(id,option){return commandLegacyResident({world,id,option});},
 getSnapshot(){return world.getActivitySnapshot();},
 async getHistory(query={}){if(query.actorId)world.trackActivityPerson(query.actorId);return world.getActivityHistory(query);},
 subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
 selectPerson(id){selected=world.people.find(p=>String(p.id)===String(id))??null;},
};
window.hblPersonCommands={getActor:()=>selected?{...selected,id:String(selected.id),label:selected.name,mode:'legacy'}:null};
window.hblGuidedActions={resident:async()=>{selected=world.people[0];},week(){},storm(){},tenYear(){}};
window.hblFixture={world,step(minutes){world.step(minutes);for(const listener of listeners)listener({mode:'legacy',minute:world.t});}};
setInterval(()=>{if(!document.body.dataset.paused)window.hblFixture.step(2);},250);
await import('/world/launch-shell.js');
document.body.dataset.ready='1';
</script></body></html>`;

test.beforeEach(async({page})=>{
 await page.route('**/world/life-story-fixture.html*',route=>route.fulfill({contentType:'text/html',body:fixture}));
});

async function openStory(page){
 await page.goto('/world/life-story-fixture.html');
 await expect(page.locator('body[data-ready="1"]')).toBeAttached({timeout:30000});
 await page.locator('[data-launch="start"]').click();
 const panel=page.locator('#launch-panel');
 await expect(panel.getByRole('heading',{name:'Life story'})).toBeVisible();
 return panel;
}

for(const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]){
 test(`Get started opens a narrated, inspectable life story (${viewport.name})`,async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  const panel=await openStory(page);
  const name=await page.evaluate(()=>window.hblFixture.world.people[0].name);
  await expect(panel.locator('.life-story-who h3')).toHaveText(name);
  await expect(page.locator('#launch-status')).toContainText(`Meet ${name}.`);
  await expect(panel.locator('.life-story-needs [role=meter]')).toHaveCount(4);
  await expect(panel.locator('.life-story-now-line')).toContainText('Now ·');
  await page.evaluate(()=>window.hblFixture.step(150));
  await expect.poll(()=>panel.locator('.life-story-beat').count()).toBeGreaterThanOrEqual(3);
  await expect(panel).not.toContainText('{"');
  await expect(panel).toContainText('retained');
  const why=panel.locator('.life-story-why').first();
  await why.locator('summary').click();
  await expect(why).toContainText('Model rule:');
  // Live refresh keeps an opened explanation open.
  const whyId=await why.getAttribute('data-id');
  await page.evaluate(()=>window.hblFixture.step(30));await page.waitForTimeout(1500);
  await expect(panel.locator(`details[data-id="${whyId}"]`)).toHaveAttribute('open','');
  await expect(panel.locator('.life-story-provenance code')).toContainText('life-story.v1 / life-story-narration.v1');
  const box=await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);
  await page.screenshot({path:info.outputPath(`life-story-${viewport.name}.png`)});
  if(process.env.HBL_LIFE_STORY_SHOTS)await page.screenshot({path:`${process.env.HBL_LIFE_STORY_SHOTS}/life-story-after-${viewport.name}.png`});
  expect(errors).toEqual([]);
 });
}

test('a nudge changes the resident’s day and the story shows what followed',async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:900});
 const panel=await openStory(page);
 const nudge=panel.locator('.life-story-nudge button').first();
 await expect(nudge).toBeVisible();
 await page.evaluate(()=>{document.body.dataset.paused='1';});
 await nudge.click();
 await expect(page.locator('#launch-status')).toContainText('Watch the story for what happens.');
 await page.evaluate(()=>window.hblFixture.step(90));
 const asked=panel.locator('.life-story-beat[data-kind="influence"]').filter({hasText:'You asked'});
 await expect(asked).toHaveCount(1);
 await expect(panel.locator('.life-story-beat[data-kind="travel"]').filter({hasText:'as you asked'})).toHaveCount(1);
 await page.screenshot({path:info.outputPath('life-story-nudge.png')});
 if(process.env.HBL_LIFE_STORY_SHOTS)await page.screenshot({path:`${process.env.HBL_LIFE_STORY_SHOTS}/life-story-after-nudge.png`});
 // Facts-only mode hides cosmetic narration and opens the recorded facts.
 await panel.getByLabel('Show narration').uncheck();
 await expect(panel.locator('.life-story-beat .life-story-narration').first()).toBeHidden();
 await expect(panel.locator('.life-story-beat .life-story-facts').first()).toHaveAttribute('open','');
 await expect(panel.locator('.life-story-beat .life-story-facts').first()).toContainText('recorded');
 if(process.env.HBL_LIFE_STORY_SHOTS)await page.screenshot({path:`${process.env.HBL_LIFE_STORY_SHOTS}/life-story-after-facts-only.png`});
 // Closing the panel stops refreshing.
 await page.keyboard.press('Escape');
 await expect(page.locator('#launch-panel')).toBeHidden();
 expect(errors).toEqual([]);
});

test('Life story explains how to start when nobody is selected',async({page})=>{
 await page.goto('/world/life-story-fixture.html');
 await expect(page.locator('body[data-ready="1"]')).toBeAttached({timeout:30000});
 await page.locator('[data-launch="legends"]').click();
 await expect(page.locator('#launch-panel')).toContainText('Choose Get started, or pick someone in People, to read their life story.');
});
