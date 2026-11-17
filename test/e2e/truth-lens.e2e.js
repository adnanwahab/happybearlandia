import {test,expect} from '@playwright/test';
for(const width of [1440,390])test(`Truth Lens native entry and cleanup ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto('/world/?demo=1&synthetic=1&people=16');
 const button=page.getByRole('button',{name:'Truth Lens',exact:true});
 await expect(button).toHaveAttribute('aria-pressed','false');
 await button.focus();await page.keyboard.press('Enter');
 await expect(button).toHaveAttribute('aria-pressed','true');
 const legend=page.getByRole('list',{name:'Truth Lens provenance legend'});
 await expect(legend).toBeVisible();await expect(legend.locator('li')).toHaveCount(5);
 await expect(legend).toContainText('Unknown');
 await page.evaluate(async()=>{const {mountTruthReadout,inspectedTruth}=await import('/world/truth-lens.js');const el=document.getElementById('inspect');el.style.display='block';mountTruthReadout(el,inspectedTruth({type:'person'}));});
 await expect(page.getByRole('region',{name:'Inspected object provenance'})).toContainText('Assumed');
 await page.screenshot({path:`/tmp/SHE-748-truth-${width}.png`});
 await button.click();await expect(legend).toBeHidden();
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 await expect(page.locator('html')).not.toHaveAttribute('data-truth-lens');
});
