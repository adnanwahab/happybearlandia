import {test,expect} from '@playwright/test';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
test('selected household postcard supports keyboard, unchanged control and saved reopening',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/world/future-machine.html');
 const panel=page.getByRole('region',{name:'Follow a synthetic family'});
 await expect(panel).toContainText('No recorded households available.');
 await page.screenshot({path:info.outputPath('postcard-before.png'),fullPage:true});
 await page.getByRole('combobox',{name:'Plan',exact:true}).selectOption('baseline');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 await expect(panel).toContainText('Unchanged outcome in the displayed household observations.');
 const picker=panel.getByRole('combobox',{name:'Family',exact:true});await picker.focus();await picker.press('ArrowDown');await picker.press('Enter');
 const id=await picker.inputValue();expect(id).toBeTruthy();
 const record=panel.getByText('Exact household, unit and building records',{exact:true}).first();await record.focus();await record.press('Enter');
 const before=await panel.locator('pre').first().textContent();expect(JSON.parse(before).household.id).toBe(id);
 await expect(panel).toContainText('House view unavailable');expect(await panel.locator('[role=img]').count()).toBe(0);
 await page.reload();await ready(page);await panel.getByRole('combobox',{name:'Family',exact:true}).selectOption(id);
 expect(await panel.locator('pre').first().textContent()).toBe(before);
 await page.screenshot({path:info.outputPath('postcard-after.png'),fullPage:true});
});
test('touch selection, unavailable join and bounded household selection measurement',async({browser,baseURL},info)=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
 const page=await context.newPage();try{
 await page.goto(baseURL+'/world/future-machine.html');
 await page.route('**/api/city-experiments/*/replay',async route=>{const response=await route.fetch(),body=await response.json();for(const step of body.steps??[])step.state.units=[];await route.fulfill({response,json:body});});
 await page.getByRole('button',{name:'Fork City',exact:true}).tap();await ready(page);
 await page.getByTestId('future-machine-timeline').fill('1');await page.getByTestId('future-machine-timeline').dispatchEvent('input');
 const panel=page.getByRole('region',{name:'Follow a synthetic family'});await expect(panel).toContainText('Comparison unavailable');
 await panel.getByRole('button',{name:'Follow this family',exact:true}).tap();await expect(panel.getByRole('button',{name:'Stop following',exact:true})).toHaveAttribute('aria-pressed','true');
 const samples=await panel.getByRole('combobox',{name:'Family',exact:true}).evaluate(select=>Array.from({length:20},(_,i)=>{select.selectedIndex=i%select.options.length;const start=performance.now();select.dispatchEvent(new Event('change'));return performance.now()-start;}));
 await info.attach('selection-timings-ms',{body:JSON.stringify(samples),contentType:'application/json'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('postcard-mobile-unavailable.png'),fullPage:true});
 }finally{await context.close();}
});
