import {test,expect} from '@playwright/test';

test('constitution route compiles exact text into five candidate groups and actual mapped synchronized paired worlds',async({page})=>{
 test.setTimeout(180000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const response=await page.goto('/visualize-constitution?renderer=webgl&lat=29.7286&lng=-95.4746');expect(response.status()).toBe(200);
 await page.waitForFunction(()=>Boolean(window.hblConstitutionCity?.editor),null,{timeout:60000});
 const text='[h_lots] Allow more homes on eligible lots.\nRight: Fair access to housing.\nPower: The city may authorize additional dwellings.\nInstitution: Housing office.\nProcedure: Publish permit decisions.\nConstraint: Retain due process.\n';
 const editor=page.getByTestId('constitution-compiler');await editor.getByLabel('Constitution text',{exact:true}).fill(text);await page.getByTestId('compile-constitution').click();
 await expect.poll(()=>page.evaluate(()=>window.hblConstitutionCity.compilation?.sourceText),{timeout:60000}).toBe(text);
 await expect.poll(()=>page.evaluate(()=>Boolean(window.hblConstitutionCity.studio.getState().selected)),{timeout:90000}).toBe(true);
 const compiled=await page.evaluate(()=>{const host=window.hblConstitutionCity;return{compiled:host.compilation,initial:host.initial.provenance,state:host.studio.getState(),stats:host.views.map(view=>view.getStats())};});
 for(const key of ['rights','powers','institutions','procedures','constraints']){expect(compiled.compiled[key]).toHaveLength(1);expect(compiled.compiled[key][0].legalDetermination).toBe(false);}
 expect(compiled.compiled.clauses[0].sourceText).toBe(text);expect(compiled.compiled.clauses[0].trace.mechanism).toBeTruthy();expect(compiled.compiled.clauses[0].trace.parameters.length).toBeGreaterThan(0);expect(compiled.compiled.clauses[0].trace.outcomeKeys.length).toBeGreaterThan(0);
 await expect(editor.getByTestId('compiler-traces')).toContainText('mechanism');expect(compiled.state.result.runs.every(row=>row.status==='completed')).toBe(true);
 expect(compiled.initial.geometrySource).toMatch(/openstreetmap|osm|mapped/i);expect(compiled.stats).toHaveLength(2);for(const stats of compiled.stats){expect(stats.objects).toBeGreaterThan(0);expect(stats.source.geometrySource).toMatch(/openstreetmap|osm|mapped/i);}
 const highlighted=compiled.stats[1].geographicDiff;expect(highlighted.buildingIds.length).toBeGreaterThan(0);const selectedBuildings=new Set(compiled.state.selected.state.buildings.map(row=>row.id));for(const id of highlighted.buildingIds)expect(selectedBuildings.has(id)).toBe(true);for(const parcelId of highlighted.parcelIds)for(const building of compiled.state.selected.state.buildings.filter(row=>row.parcelId===parcelId))expect(highlighted.buildingIds).toContain(building.id);
 const before=await page.evaluate(()=>window.hblConstitutionCity.views[0].getCamera());const canvas=page.getByTestId('constitution-studio').locator('[data-cc-before] canvas');await canvas.scrollIntoViewIfNeeded();const bounds=await canvas.boundingBox();await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.5+45,bounds.y+bounds.height*.5+10,{steps:5});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>JSON.stringify(window.hblConstitutionCity.views[0].getCamera().position))).not.toBe(JSON.stringify(before.position));
 const cameras=await page.evaluate(()=>window.hblConstitutionCity.views.map(view=>view.getCamera()));for(const key of ['position','target'])for(let i=0;i<3;i++)expect(cameras[0][key][i]).toBeCloseTo(cameras[1][key][i],4);
 const unknown='[no-reviewed-adapter] Guarantee instant happiness everywhere.\nRight: Joy.\n';await editor.getByLabel('Constitution text',{exact:true}).fill(unknown);await page.getByTestId('compile-constitution').click();
 await expect.poll(()=>page.evaluate(()=>window.hblConstitutionCity.compilation?.sourceText)).toBe(unknown);await expect.poll(()=>page.evaluate(()=>Boolean(window.hblConstitutionCity.studio.getState().selected)),{timeout:90000}).toBe(true);
 const unsupported=await page.evaluate(()=>{const host=window.hblConstitutionCity,result=host.studio.getState().result;return{supported:host.compilation.clauses[0].supported,trace:host.compilation.clauses[0].trace,runs:result.runs.map(row=>({seed:row.seed,index:row.runIndex,scenario:row.scenarioId,metrics:row.metricsTimeline.at(-1).metrics}))};});
 expect(unsupported.supported).toBe(false);expect(unsupported.trace.status).toBe('unmodeled');expect(unsupported.trace.parameters).toEqual([]);
 for(const row of unsupported.runs.filter(row=>row.scenario!=='current'))expect(row.metrics).toEqual(unsupported.runs.find(base=>base.scenario==='current'&&base.seed===row.seed&&base.index===row.index).metrics);
 expect(errors).toEqual([]);
});

test('constitution page lists all 90 supplied laws and copies exact selection into the editor with a frozen-city comparison',async({page})=>{
 test.setTimeout(120000);await page.goto('/visualize-constitution?renderer=webgl&lat=29.7286&lng=-95.4746');await page.waitForFunction(()=>Boolean(window.hblConstitutionCity?.lawLibrary),null,{timeout:60000});
 const library=page.getByTestId('law-library');await expect(library.locator('[data-law-id]')).toHaveCount(90);await expect(library).toContainText('Laws 1–10 were not supplied');
 await library.getByLabel('Search laws',{exact:true}).fill('21');await library.locator('[data-law-id="law-21"]').click();
 const panel=page.getByTestId('law-panel');await expect(panel).toBeVisible();const exact=await page.evaluate(()=>window.hblConstitutionCity.lawPanel.getSelection().text);expect(await page.getByLabel('Constitution text',{exact:true}).inputValue()).toBe(exact);
 await expect(panel.getByRole('table')).toContainText('Without law',{timeout:60000});await expect(panel.getByRole('status')).not.toContainText('Comparison unavailable');
});
