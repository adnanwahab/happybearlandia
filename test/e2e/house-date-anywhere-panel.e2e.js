import {test,expect} from '@playwright/test';
test('Date Anywhere searches bounded scopes without area loads, rejects stale results and retains extension DOM across ticks',async({page})=>{
 const area=[];page.on('request',r=>{if(r.url().includes('/api/area'))area.push(r.url());});await page.goto('/world/government/index.html');await page.evaluate(async()=>{const {mountDatePanel}=await import('/world/house/date-ui.js');window.searches=[];window.pendingSearches=[];window.commands=[];window.mounts=0;window.updates=0;window.destroys=0;window.panel=mountDatePanel(document.body,{onCommand:async p=>{commands.push(p);return{accepted:true};},onSearchVenues:input=>new Promise(resolve=>{searches.push({scope:input.scope,maxDriveMinutes:input.maxDriveMinutes,query:input.query,origin:input.origin,signal:input.signal});pendingSearches.push(resolve);}),modules:{renderer:host=>{mounts++;window.scene=document.createElement('canvas');scene.dataset.stableDateCanvas='';host.append(scene);return{update(){updates++;},captureImage(){return'data:image/png;base64,fixture';},destroy(){destroys++;scene.remove();}};}}});window.dateState={minute:360,paused:true,speed:1,members:[{id:'p1',name:'Alex'},{id:'p2',name:'Jo'}],dates:{origin:{lat:29.7,lng:-95.4},venues:[],activities:[],active:null,history:[]}};panel.update(dateState);panel.open({hostPersonId:'p1',personId:'p2',hostName:'Alex',personName:'Jo'});});const panel=page.getByRole('dialog',{name:'Plan a date'});await expect(panel.getByRole('button',{name:'Drive 60 min',exact:true})).toHaveAttribute('aria-pressed','true');expect(await page.evaluate(()=>searches[0].maxDriveMinutes)).toBe(60);await panel.getByRole('button',{name:'Drive 10 min',exact:true}).click();expect(await page.evaluate(()=>searches[0].signal.aborted)).toBe(true);
 await page.evaluate(()=>{const place=(id,name)=>({schemaVersion:'date-place.v1',id,name,kind:'museum',lat:29.71,lng:-95.41,source:'osm',activities:['talk','museum'],route:{durationMinutes:8,distanceMeters:2000,source:'approximate',approximate:true,geometry:[{lat:29.7,lng:-95.4},{lat:29.71,lng:-95.41}]}});pendingSearches[1]({places:[place('osm:node:2','Current museum')],warnings:['Approximate route'],attribution:'OSM'});pendingSearches[0]({places:[place('osm:node:1','Stale museum')]});});await expect(panel.locator('[data-date-place-id="osm:node:2"]')).toBeVisible();await expect(panel.getByText('Stale museum',{exact:true})).toHaveCount(0);expect(area).toEqual([]);await panel.getByRole('button',{name:'Choose Current museum'}).click();await panel.locator('[data-date-consent=host]').check();await panel.locator('[data-date-consent=partner]').check();await panel.getByRole('button',{name:'Go together'}).click();expect(await page.evaluate(()=>commands[0])).toMatchObject({type:'start',personIds:['p1','p2'],consentingPersonIds:['p1','p2'],travelMode:'instant',replaceActive:true,origin:{lat:29.7,lng:-95.4},place:{id:'osm:node:2'}});expect(area).toEqual([]);
 await page.evaluate(()=>{dateState.dates.active={id:'date-1',phase:'traveling',personIds:['p1','p2'],venue:{id:'v',name:'Museum'},world:{origin:{lat:29.71,lng:-95.41}},travel:{mode:'drive',etaMinute:368,progress:.25,source:'approximate',approximate:true},people:[{id:'p1',name:'Alex',datePosition:{x:0,z:0},needs:{energy:70}},{id:'p2',name:'Jo',datePosition:{x:1,z:0},needs:{energy:75}}]};for(let i=0;i<50;i++){dateState.minute=360+i/10;panel.update(dateState);}});expect(await page.evaluate(()=>({mounts,destroys,connected:scene.isConnected,same:panel.getHost('renderer').contains(scene)}))).toEqual({mounts:1,destroys:0,connected:true,same:true});await expect(panel.locator('[data-date-travel-bar]')).toHaveAttribute('value','0.25');await expect(panel.locator('[data-date-travel-source]')).toBeHidden();expect(await page.evaluate(()=>panel.captureImage())).toBe('data:image/png;base64,fixture');await page.evaluate(()=>panel.destroy());expect(await page.evaluate(()=>destroys)).toBe(1);
});

test('repeat date planning stays visible during return travel and after past dates',async({page})=>{
 await page.goto('/world/government/index.html');
 await page.evaluate(async()=>{
  const {mountDatePanel}=await import('/world/house/date-ui.js');
  window.requests=[];
  window.repeatState={minute:1440,paused:true,members:[{id:'p1',name:'Alex'},{id:'p2',name:'Jo'}],dates:{venues:[{id:'location:1',name:'Neighborhood park'}],history:[{id:'old-date',status:'completed'}],active:{id:'returning-date',phase:'traveling-home',personIds:['p1','p2'],people:[],travel:{etaMinute:1450,progress:.4}}}};
  window.repeatPanel=mountDatePanel(document.body,{onSearchVenues:async()=>({places:[]}),onCommand:async input=>{requests.push(input);if(input.type==='end'){repeatState.dates.active=null;repeatPanel.update(repeatState);}return {accepted:true};}});
  repeatPanel.update(repeatState);repeatPanel.open({hostPersonId:'p1',personId:'p2',hostName:'Alex',personName:'Jo'});
 });
 const panel=page.getByRole('dialog',{name:'Plan a date'});
 await expect(panel.getByRole('combobox',{name:'Date location',exact:true})).toBeVisible();
 await expect(panel.getByRole('button',{name:'Go together',exact:true})).toBeEnabled();
 await panel.locator('[data-date-consent=host]').uncheck();
 await page.evaluate(()=>{for(let i=0;i<5;i++)repeatPanel.update(repeatState);});
 await expect(panel.getByRole('combobox',{name:'Date duration',exact:true})).toBeVisible();
 await expect(panel.locator('[data-date-go-reason]')).toContainText('Both people must agree');
 await panel.locator('[data-date-consent=host]').check();await panel.locator('[data-date-consent=partner]').check();
 await expect(panel.getByRole('button',{name:'Go together',exact:true})).toBeEnabled();
 await expect(panel.locator('[data-date-go-reason]')).toContainText('directly to your date');
 await panel.getByRole('button',{name:'Go together',exact:true}).click();
 await expect(panel.locator('.date-section-links')).toHaveCount(0);
 expect(await page.evaluate(()=>requests)).toHaveLength(1);
 await expect(panel.getByRole('combobox',{name:'Date location',exact:true})).toBeVisible();

 expect(await page.evaluate(()=>requests[0])).toMatchObject({type:'start',replaceActive:true,travelMode:'instant',personIds:['p1','p2'],venueId:'location:1'});
});

test('Go together allows an ongoing date and explains missing destination',async({page})=>{
 await page.goto('/world/government/index.html');
 await page.evaluate(async()=>{const {mountDatePanel}=await import('/world/house/date-ui.js');window.guardState={minute:360,members:[],dates:{venues:[],active:null}};window.guardPanel=mountDatePanel(document.body,{onSearchVenues:async()=>({places:[]})});guardPanel.update(guardState);guardPanel.open({hostPersonId:'p1',personId:'p2'});});
 const panel=page.getByRole('dialog',{name:'Plan a date'});
 await expect(panel.locator('[data-date-go-reason]')).toHaveText('Choose a destination.');
 await page.evaluate(()=>{guardState.dates.venues=[{id:'location:1',name:'Park'}];guardState.dates.active={id:'ongoing',phase:'date',people:[]};guardPanel.update(guardState);});
 await expect(panel.locator('.date-section-links')).toHaveCount(0);
 await expect(panel.getByRole('button',{name:'Go together',exact:true})).toBeEnabled();
 await expect(panel.locator('[data-date-consent=host]')).toBeChecked();
 await expect(panel.locator('[data-date-consent=partner]')).toBeChecked();
 await expect(panel.getByRole('button',{name:'Return home now to start another date',exact:true})).toHaveCount(0);
});

test('recommended Central Park and Arcade presets use real place searches without travel',async({page})=>{
 const areas=[];page.on('request',r=>{if(r.url().includes('/api/area'))areas.push(r.url());});
 await page.goto('/world/government/index.html');
 await page.evaluate(async()=>{const {mountDatePanel}=await import('/world/house/date-ui.js');window.presetSearches=[];window.presetCommands=[];window.presets=mountDatePanel(document.body,{onCommand:input=>{presetCommands.push(input);return{accepted:true};},onSearchVenues:async input=>{presetSearches.push({query:input.query,scope:input.scope,maxDriveMinutes:input.maxDriveMinutes});return{places:[]};}});presets.update({minute:360,members:[],dates:{origin:{lat:29.7,lng:-95.4},venues:[]}});presets.open({hostPersonId:'p1',personId:'p2'});});
 const panel=page.getByRole('dialog',{name:'Plan a date'});
 await panel.getByRole('button',{name:'🌳 Central Park',exact:true}).click();
 await expect(panel.locator('[data-date-search-query]')).toHaveValue('Central Park New York City');
 expect(await page.evaluate(()=>presetSearches.at(-1))).toEqual({query:'Central Park New York City',scope:'anywhere',maxDriveMinutes:undefined});
 await panel.getByRole('button',{name:'🕹 Arcade',exact:true}).click();
 await expect(panel.locator('[data-date-selected-name]')).toHaveText('Immersive Gamebox — Marq-E');
 await expect(panel.locator('[data-date-selected-source]')).toContainText('7620 Katy Freeway');
 await expect(panel.locator('[data-date-search-host]')).toBeHidden();
 await panel.getByRole('button',{name:'🥾 Bear Mountain hike',exact:true}).click();
 await expect(panel.locator('[data-date-search-query]')).toHaveValue('Bear Mountain State Park New York');
 expect(await page.evaluate(()=>presetSearches.at(-1))).toEqual({query:'Bear Mountain State Park New York',scope:'anywhere',maxDriveMinutes:undefined});
 expect(await page.evaluate(()=>presetCommands)).toEqual([]);expect(areas).toEqual([]);
});

test('Yark Green mystery preset selects the real curated restaurant and keeps consent required',async({page})=>{
 await page.goto('/world/government/index.html');
 await page.evaluate(async()=>{const {mountDatePanel}=await import('/world/house/date-ui.js');window.thaiCommands=[];window.thaiPanel=mountDatePanel(document.body,{onSearchVenues:async()=>({places:[]}),onCommand:async input=>{thaiCommands.push(input);return{accepted:true};}});thaiPanel.update({minute:360,members:[{id:'p1',name:'Alex'},{id:'p2',name:'Jo'}],dates:{venues:[],active:null}});thaiPanel.open({hostPersonId:'p1',personId:'p2'});});
 const panel=page.getByRole('dialog',{name:'Plan a date'});
 await panel.getByRole('button',{name:'🍜 Yark Green · mystery dinner',exact:true}).click();
 await expect(panel.locator('[data-date-selected-name]')).toHaveText('Yark Green Thai Restaurant');
 await expect(panel.locator('[data-date-selected-source]')).toContainText('23227 Mercantile');
 await expect(panel.locator('[data-date-travel-mode]')).toHaveValue('instant');
 await expect(panel.getByRole('button',{name:'Go together',exact:true})).toBeEnabled();
 await panel.locator('[data-date-consent=host]').uncheck();
 await expect(panel.getByRole('button',{name:'Go together',exact:true})).toBeDisabled();
 await panel.locator('[data-date-consent=host]').check();
 await panel.getByRole('button',{name:'Go together',exact:true}).click();
 expect(await page.evaluate(()=>thaiCommands[0])).toMatchObject({type:'start',personIds:['p1','p2'],travelMode:'instant',place:{id:'curated:yark-green-thai',name:'Yark Green Thai Restaurant',source:'curated',lat:29.7892732,lng:-95.7720937}});
});

test('recommended destination fills its address and hides custom search without a second selection',async({page})=>{
 await page.goto('/world/government/index.html');
 await page.evaluate(async()=>{const {mountDatePanel}=await import('/world/house/date-ui.js');window.autoPreset=mountDatePanel(document.body,{onSearchVenues:async()=>({places:[{schemaVersion:'date-place.v1',id:'osm:relation:1',name:'Central Park',kind:'park',lat:40.7829,lng:-73.9654,address:'Central Park, Manhattan, New York',source:'osm'}]})});autoPreset.update({minute:360,members:[],dates:{venues:[]}});autoPreset.open({hostPersonId:'p1',personId:'p2'});});
 const panel=page.getByRole('dialog',{name:'Plan a date'});
 await panel.getByRole('button',{name:'🌳 Central Park',exact:true}).click();
 await expect(panel.locator('[data-date-selected-name]')).toHaveText('Central Park');
 await expect(panel.locator('[data-date-selected-source]')).toContainText('Manhattan');
 await expect(panel.locator('[data-date-search-host]')).toBeHidden();
 await expect(panel.getByRole('button',{name:'Go together',exact:true})).toBeEnabled();
 await panel.getByRole('button',{name:'Choose a different place',exact:true}).click();
 await expect(panel.getByRole('searchbox',{name:'Search date places'})).toBeVisible();
});
