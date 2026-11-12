import {test,expect} from '@playwright/test';
test('demo preserves household options and announces captions only',async({page})=>{
 await page.goto('/world/future-machine.html?renderer=canvas');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
 await page.getByTestId('future-machine-demo').click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.demo?.elapsedMs)).toBeGreaterThan(10000);
 await page.evaluate(()=>{
  window.calm={options:0,captions:0};
  const select=document.querySelector('select[aria-label="Monthly City household"]');
  new MutationObserver(rows=>window.calm.options+=rows.length).observe(select,{childList:true,subtree:true});
  new MutationObserver(rows=>window.calm.captions+=rows.length).observe(document.querySelector('.fm-demo-caption'),{childList:true,subtree:true,characterData:true});
 });
 await page.waitForTimeout(2500);
 expect(await page.evaluate(()=>window.calm)).toEqual({options:0,captions:0});
 expect(await page.locator('.fm-demo-caption').textContent()).not.toMatch(/\d+s/);
});
