import {test,expect} from '@playwright/test';
import {computeEffectsForYear} from '../../world/policy.js';
import {LEVERS,leverValue} from '../../world/plan-choices.js';
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
  for(const [key,,name,min] of LEVERS){
    const slider=cards.getByRole('slider',{name,exact:true});
    await slider.focus();await page.keyboard.press('ArrowRight');
    const value=key==='voucherMonthly'?1:min+.01;
    await expect(slider).toHaveValue(String(value));
    await expect(slider).toHaveAttribute('aria-valuetext',leverValue(key,value));
  }
  await page.locator('#runCycleBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.planMessages.length)).toBe(1);
  const payload=await page.evaluate(()=>window.planMessages[0]);expect(payload.customEffects).toEqual({speedMult:1.01,floodMitigation:.01,housingGrowth:.01,voucherMonthly:1});expect(payload.proposalIds).toEqual([]);expect(payload.year).toBe(3);
  await expect(page.locator('#cycleStatus')).toContainText('complete',{timeout:100000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('every preset card describes its submitted worker inputs and popularity source',async({page})=>{
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;window.planMessages=[];
    window.Worker=class extends NativeWorker{postMessage(message,...args){if(message.type==='run')window.planMessages.push(message.payload);return super.postMessage(message,...args);}};
  });
  await page.goto('/world?renderer=canvas2d&people=10');
  await page.locator('#top').evaluate(el=>el.open=true);
  const recipes=[['Balanced',['t_brt','h_lots','f_drainage','s_311']],['Minimal change',['t_bus','s_311','sb_filing']],['Most popular',['t_brt','h_vouchers','f_drainage','sb_payroll']]];
  for(const [name,proposalIds] of recipes){
    const radio=page.getByRole('radio',{name,exact:true});
    await radio.focus();await page.keyboard.press('Space');await expect(radio).toBeChecked();
    const card=page.locator('.plan-choice').filter({has:radio});
    const effects=computeEffectsForYear(proposalIds,3).effects;
    for(const [key,,label] of LEVERS)await expect(card.locator('[data-lever="'+key+'"] span:last-child')).toHaveText(label+': '+leverValue(key,effects[key]));
    await page.locator('#runCycleBtn').click();
    await expect.poll(()=>page.evaluate(()=>window.planMessages.at(-1)?.label)).toBe(name);
    const payload=await page.evaluate(()=>window.planMessages.at(-1));
    expect(payload.proposalIds).toEqual(proposalIds);expect(payload.year).toBe(3);expect(payload.customEffects).toBeUndefined();
    await expect(page.locator('#cycleStatus')).toContainText('complete',{timeout:100000});
  }
  const popular=page.locator('.plan-choice').filter({has:page.getByRole('radio',{name:'Most popular',exact:true})});
  await expect(popular).toContainText('no measured popularity or voter population');
  await popular.getByRole('link',{name:'Package source'}).click();
  await expect(page.getByRole('heading',{name:'World local plan sources'})).toBeVisible();
  await expect(page.locator('main')).toContainText('There are no local votes');
});
