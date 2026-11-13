import {test,expect} from '@playwright/test';
import {DEFAULT_RECIPE} from '../../world/future-machine/contracts.js';
import {createShareURL} from '../../world/future-machine/share/index.js';

for(const intervention of [null,{...DEFAULT_RECIPE.intervention,cost:0,delay:0,compliance:0}])test(`visible matched inputs survive sharing: ${intervention?'zero policy values':'control'}`,async({page},info)=>{
 const recipe={...DEFAULT_RECIPE,seed:0,intervention};
 const ready=()=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
 await page.goto(createShareURL({recipe,month:120},'http://localhost/world/future-machine.html').replace('http://localhost',''));
 await ready();
 const baseline=page.getByTestId('future-machine-inputs-baseline'),plan=page.getByTestId('future-machine-inputs-plan');
 for(const box of [baseline,plan]){await expect(box).toBeVisible();await expect(box).toContainText('Seed 0 · Horizon 120 months · Starting population 90 people (30 households)');}
 await expect(baseline).toContainText('no intervention · 0 added homes · 0 USD intervention cost');
 await expect(plan).toContainText(intervention?'24 proposed homes · 0 illustrative USD · delay 0 months · compliance 0':'no intervention · 0 added homes');
 const before=await plan.textContent();
 const hash=await page.evaluate(()=>window.futureMachine.history.initialHash);
 await page.getByLabel('Seed for next run',{exact:false}).fill('7');
 await expect(plan).toHaveText(before);
 await page.getByRole('button',{name:'Share comparison',exact:true}).click();
 await page.goto(await page.getByRole('link',{name:'Open comparison link'}).getAttribute('href'));await ready();
 await expect(plan).toHaveText(before);
 expect(await page.evaluate(()=>window.futureMachine.history.initialHash)).toBe(hash);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('comparison-inputs.png'),fullPage:true});
});
