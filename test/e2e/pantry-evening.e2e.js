import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('keyboard pantry scene exposes empty-stock fallback and requests model cooking',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:844});
 // Static module fixture: no local server, live data or WebGL dependency.
 await page.route('https://pantry.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/fixture')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'});
  if(!['/world/','/shared/'].some(prefix=>path.startsWith(prefix))||!path.endsWith('.js'))return route.abort();
  return route.fulfill({contentType:'text/javascript',body:await readFile(process.cwd()+path,'utf8')});
 });
 await page.goto('https://pantry.test/fixture');
 await page.evaluate(async()=>{
  const {createPopulationModel,stepPopulation}=await import('/world/population/model.js');
  const {getHouseState,configureHouseLife}=await import('/world/house/model.js');
  const {applyHouseholdSystemCommand}=await import('/world/house/system-command.js');
  const {applyHouseEconomyCommand}=await import('/world/house/household-economy.js');
  const {createEveningSystem}=await import('/world/house/evening-system.js');
  const {mountHouseEvening}=await import('/world/house/evening-ui.js');
  const m=createPopulationModel({population:8,householdSize:4,seed:42,employmentRate:0},{},{initialMinute:1080,initialTick:1080});
  for(let i=0;i<4;i++){m.people.ageYears[i]=30;m.people.employed[i]=0;m.people.current[i]=m.people.home[i];m.people.x[i]=m.people.homeX[i];m.people.z[i]=m.people.homeZ[i];m.people.remaining[i]=0;}
  const householdId=m.prefix+'-h0',personId=m.prefix+'-p0';
  configureHouseLife(m,{householdId,autonomy:false,parameters:{firePerCookMinute:0,breakagePerUseHour:0,eventChancePerDay:0}});
  applyHouseEconomyCommand(m,m.houses.homes[0],{type:'enablePantry',personId,value:true});
  document.body.replaceChildren();const host=document.createElement('main');document.body.append(host);
  const sys=createEveningSystem(),ui=mountHouseEvening(host,{onCommand:async input=>{const r=applyHouseholdSystemCommand(m,{householdId,system:'evening',...input});refresh();return r;}});
  function refresh(){ui.update({evening:sys.inspect(m,getHouseState(m,0)),people:[]});}
  window.pantryFixture={stock(){m.houses.homes[0].systems.economy.stock.rice=1;refresh();},state(){const h=m.houses.homes[0];return{rice:h.systems.economy.stock.rice,servings:h.preparedServings,actions:h.actions.map(a=>a.type)};},finish(){for(let n=0;n<100&&m.houses.homes[0].actions.length;n++)stepPopulation(m,{minutes:1});refresh();}};
  refresh();ui.open();
 });
 const panel=page.getByRole('dialog',{name:'Make tonight a good night',exact:true});
 await page.screenshot({path:'.mini-symphony-evidence/SHE-558-before-pantry-mobile.png'});
 const begin=panel.getByRole('button',{name:'Cook together from the pantry',exact:true});
 await begin.focus();await page.keyboard.press('Enter');
 await expect(panel.getByRole('region',{name:'Pantry cooking requirements'})).toContainText('Rice: 0 available / 1 needed');
 const cook=panel.getByRole('button',{name:'Cook an available pantry recipe',exact:true});
 await expect(cook).toBeDisabled();
 await page.evaluate(()=>pantryFixture.stock());
 await expect(cook).toBeEnabled();await cook.focus();await page.keyboard.press('Enter');
 expect(await page.evaluate(()=>pantryFixture.state())).toMatchObject({rice:0,servings:0,actions:['cookRecipe']});
 await page.evaluate(()=>pantryFixture.finish());
 await expect(panel.getByRole('button',{name:'Share the prepared food',exact:true})).toBeEnabled();
 await page.screenshot({path:'.mini-symphony-evidence/SHE-558-after-pantry-mobile.png'});
 await page.keyboard.press('Escape');await expect(panel).toBeHidden();
});
