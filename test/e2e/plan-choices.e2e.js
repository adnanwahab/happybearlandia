import {test,expect} from '@playwright/test';
for(const width of [1280,320])test('World plan cards, keyboard sliders and exact worker inputs at '+width,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;window.planMessages=[];
    window.Worker=class extends NativeWorker{postMessage(message,...args){if(message.type==='run'&&message.payload?.days===7)window.planMessages.push(message.payload);return super.postMessage(message,...args);}};
  });
  await page.goto('/world?renderer=canvas2d&people=10');
  await page.locator('#top').evaluate(el=>el.open=true);
  const cards=page.locator('#planChoices');
  await expect(cards.getByRole('radio',{name:'Balanced',exact:true})).toBeVisible();
  await cards.getByRole('radio',{name:'Balanced',exact:true}).check();
  await expect(cards.locator('.plan-choice').filter({has:page.getByRole('radio',{name:'Balanced',exact:true})})).toContainText('housing growth 14%');
  const custom=cards.getByRole('radio',{name:'Make my own'});await custom.focus();await page.keyboard.press('Space');await expect(custom).toBeChecked();await expect(custom).toBeFocused();
  const transit=cards.getByRole('slider',{name:'Transit speed multiplier'});await transit.focus();await page.keyboard.press('ArrowRight');await expect(transit).toHaveValue('1.01');
  await expect(transit).toHaveAttribute('aria-valuetext','×1.01');
  await page.locator('#runCycleBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.planMessages.length)).toBe(1);
  const payload=await page.evaluate(()=>window.planMessages[0]);expect(payload.customEffects).toEqual({speedMult:1.01,floodMitigation:0,housingGrowth:0,voucherMonthly:0});expect(payload.proposalIds).toEqual([]);expect(payload.year).toBe(3);
  await expect(page.locator('#cycleStatus')).toContainText('complete',{timeout:100000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
