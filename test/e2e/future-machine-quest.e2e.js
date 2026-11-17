import {test,expect} from '@playwright/test';
test('optional quest uses real paired records and keyboard actions',async({page})=>{
 await page.goto('/world/future-machine.html');const quest=page.getByRole('region',{name:'Optional discovery quest'});
 await expect(quest.getByRole('button',{name:'Visit first divergence'})).toBeDisabled();
 await quest.getByRole('button',{name:'Hide quest'}).press('Enter');await expect(quest.getByRole('list')).toBeHidden();await quest.getByRole('button',{name:'Show quest'}).press('Enter');
 await page.getByRole('button',{name:'Fork City',exact:true}).press('Enter');await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
 await expect(quest.getByRole('listitem').nth(0)).toContainText('✓');await expect(quest.getByRole('listitem').nth(1)).not.toContainText('✓');
 await quest.getByRole('button',{name:'Visit first divergence'}).press('Enter');
 const actual=await page.evaluate(()=>({month:window.futureMachine.state.month,entities:window.futureMachine.state.diff.entities}));expect(actual.month).toBeGreaterThan(0);expect(actual.entities.length).toBeGreaterThan(0);
 await quest.getByRole('button',{name:'Inspect quest entity'}).press('Enter');await expect(quest.getByRole('status')).toContainText('Quest complete');
 await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText(actual.entities[0].id);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
