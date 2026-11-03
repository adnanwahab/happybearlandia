import {test,expect} from '@playwright/test';

test('person details and city tools open separately',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/world?living=1');
 await page.waitForFunction(()=>window.hblLivingWorld?.getSnapshot()?.visibleAgents?.length,null,{timeout:90000});
 await page.evaluate(async()=>{const world=window.hblLivingWorld;await world.selectPerson(world.getSnapshot().visibleAgents[0].id);});
 const person=page.getByTestId('living-person'),overview=page.getByTestId('living-city');
 await expect(person).toBeVisible();await expect(overview).toBeHidden();
 await expect(person.locator('[data-lc-needs]')).toBeVisible();
 await expect(person.locator('[data-lc-stats], [data-lc-studio], [data-lc-layer]')).toHaveCount(0);
 await person.locator('[data-lc-household]').click();
 await expect(person.locator('[data-lc-household-panel]')).toContainText('Synthetic household');
 await page.getByTestId('living-city-overview').click();
 await expect(person).toBeHidden();await expect(overview).toBeVisible();
 await expect(overview.locator('[data-lc-stats]')).toBeVisible();
 await expect(overview.locator('[data-lc-person]')).toHaveCount(0);
 await overview.locator('[data-lc-sample]').click();
 await expect(person).toBeVisible();await expect(overview).toBeHidden();
 await person.locator('[data-lc-person-close]').click();await expect(person).toBeHidden();
});
