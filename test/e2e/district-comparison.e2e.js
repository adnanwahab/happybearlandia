import {createRequire} from 'node:module';
const {test,expect}=createRequire((process.env.HBL_TEST_DEPENDENCY_ROOT||process.cwd())+'/package.json')('@playwright/test');
test('real flagship district values follow month0/16/120, refresh and 320px keyboard with no GPU',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{try{Object.defineProperty(navigator,'gpu',{value:undefined});}catch{}const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};});
 await page.goto('/world/future-machine.html');await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
 const panel=page.getByRole('region',{name:'District comparison'}),row=panel.locator('tr[data-district="d1"]');
 await expect(panel).toBeVisible();await expect(row.locator('[data-delta]')).toHaveText('0');
 const slider=page.getByTestId('future-machine-timeline');
 async function month(n){await slider.fill(String(n));await slider.dispatchEvent('input');await expect(panel.locator('caption')).toContainText(`Month ${n} ·`);}
 await month(16);await expect(row.locator('[data-delta]')).toHaveText('+24');
 const values=await page.evaluate(()=>{const h=window.futureMachine.history;return ['baseline','plan'].map(arm=>h[arm][16].state.units.filter(u=>u.districtId==='d1').length);});expect(values).toEqual([12,36]);
 await expect(row.locator('[data-arm="baseline"]')).toContainText('12');await expect(row.locator('[data-arm="plan"]')).toContainText('36');
 await panel.screenshot({path:info.outputPath('district-month16-desktop.png')});
 await panel.getByRole('combobox',{name:'District metric'}).selectOption('mean_rental_unit_rent');await expect(panel.locator('caption')).toContainText('illustrative USD/month');
 await panel.getByRole('combobox',{name:'District metric'}).selectOption('housing_units');
 await month(120);await expect(row.locator('[data-delta]')).toHaveText('+24');await page.reload();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');await expect(panel.locator('caption')).toContainText('Month 120');await expect(row.locator('[data-delta]')).toHaveText('+24');
 await page.setViewportSize({width:320,height:720});await month(0);await expect(row.locator('[data-delta]')).toHaveText('0');await month(16);
 const picker=panel.getByRole('combobox',{name:'District metric'});await picker.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect(picker).toBeFocused();await picker.selectOption('housing_units');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await panel.screenshot({path:info.outputPath('district-month16-320.png')});
 await info.attach('run',{body:JSON.stringify(await page.evaluate(()=>({run:window.futureMachine.history.experimentId,seed:window.futureMachine.history.seed,month:window.futureMachine.state.month,model:window.futureMachine.history.modelVersion}))),contentType:'application/json'});
 expect(errors).toEqual([]);
});
