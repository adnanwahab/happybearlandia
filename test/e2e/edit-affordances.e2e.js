import {test,expect} from '@playwright/test';
test('World normal entry exposes hints and keyboard opens existing review without changing inputs',async({page})=>{
 await page.goto('/world/?demo=1&synthetic=1&people=16');
 const hints=page.getByRole('complementary',{name:'Editable world hints'});
 await expect(hints).toBeVisible();
 await page.screenshot({path:'.mini-symphony-evidence/SHE-468-after-desktop.png'});
 const button=hints.getByRole('button',{name:/Review policy/});await button.focus();await page.keyboard.press('Enter');
 await expect(page.locator('.bw-world-tools')).toHaveAttribute('open','');
 await expect(page.locator('.bw-world-tools [data-prompt]')).toBeFocused();
 await expect(page.locator('.bw-world-tools [data-preview]')).toBeHidden();
});
test.describe('touch component',()=>{
 test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
test('component: keyboard/touch, unavailable, reduced motion and read-only transitions',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/world/decision.html');
 await page.evaluate(async()=>{
  const {mountWorldTools}=await import('/world/decision/world-tools.js');
  const {housingModel,createHousingScenarios}=await import('/world/models/housing/index.js');
  window.hintInput={schemaVersion:'decision-experiment.v1',name:'Test',decision:'Test',modelId:housingModel.id,modelVersion:housingModel.version,seed:42,runs:2,years:6,scenarios:createHousingScenarios(),metadata:{}};
  window.hintBefore=JSON.stringify(window.hintInput);
  const host=document.createElement('div');host.id='hint-test';document.body.prepend(host);
  window.hintTools=mountWorldTools(host,{getInput:()=>window.hintInput,getScenarioId:()=> 'plan-a',onInputChange:()=>{throw Error('must not apply');}});
 });
 const host=page.locator('#hint-test'),hints=host.getByRole('complementary',{name:'Editable world hints'});
 await page.evaluate(()=>window.hintTools.setSelection({kind:'district',id:'downtown',location:{districtId:'downtown',x:0,z:0}}));
 await hints.getByRole('button',{name:/Draft a building here/}).tap();
 await expect(host.locator('[data-building-form]')).toBeVisible();
 expect(await page.evaluate(()=>JSON.stringify(window.hintInput)===window.hintBefore)).toBe(true);
 await page.evaluate(()=>window.hintTools.update({readOnly:true}));await expect(hints).toBeHidden();
 await page.evaluate(()=>window.hintTools.update({readOnly:false}));await expect(hints).toBeVisible();
 await page.evaluate(()=>{window.hintInput={scenarios:[]};window.hintTools.update();});
 await expect(hints).toContainText('No supported edits available');await expect(hints.getByRole('button')).toHaveCount(0);
 await page.evaluate(()=>window.hintTools.destroy());await expect(hints).toHaveCount(0);
});

});
