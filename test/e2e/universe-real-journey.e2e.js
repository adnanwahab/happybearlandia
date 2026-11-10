import {test,expect} from '@playwright/test';
const scope={universeId:'universe:test:main',worldId:'world:test:city',scenarioId:'scenario:test:baseline',experimentId:'experiment:test:one',runId:'run:test:one',branchId:'branch:test:fork',tick:'17',entityId:'person:test:ada'};
const query=new URLSearchParams(scope).toString();
async function expectScope(page){const params=new URL(page.url()).searchParams;for(const[k,v]of Object.entries(scope))expect(params.get(k)).toBe(v);}
test('real apps preserve context through child navigation, Back, refresh and standalone entry',async({page})=>{
 await page.goto('/?app=worldline&'+query);
 const stage=page.locator('#universe-stage');await expect(stage.locator('iframe')).toHaveCount(1);
 const child=page.frameLocator('#universe-stage iframe');await expect(child.getByRole('navigation',{name:'Connected universe'})).toBeVisible();
 await expect(child.getByRole('heading',{name:'Worldline · connected futures'})).toBeVisible();await expectScope(page);
 await page.locator('#universe-search').fill('/tools/quote-carousel');await page.locator('.universe-card').getByRole('link',{name:'Enter',exact:true}).click();await expect(page).toHaveURL(/app=quote-carousel/);
 await expect(child.getByRole('navigation',{name:'Connected universe'})).toBeVisible();await child.getByRole('navigation',{name:'Connected universe'}).getByRole('link',{name:'Worldline',exact:true}).click();await expect(page).toHaveURL(/app=worldline/);await expectScope(page);
 await page.goBack();await expect(page).toHaveURL(/app=quote-carousel/);await expectScope(page);await page.reload();await expect(child.getByRole('navigation',{name:'Connected universe'})).toBeVisible();await expectScope(page);
 await page.goto('/tools/worldline?'+query);await expect(page.getByRole('navigation',{name:'Connected universe'})).toBeVisible();await page.getByRole('navigation',{name:'Connected universe'}).getByRole('link',{name:'Worldline',exact:true}).click();await expect(page).toHaveURL(/app=worldline/);await expectScope(page);
});
test('every registered standalone route serves real HTML with shared bootstrap',async({request})=>{
 const {EXPERIENCES}=await import('../../world/universe/registry.js');for(const app of EXPERIENCES){const response=await request.get(app.route);expect(response.ok(),app.id+' route').toBeTruthy();expect(response.headers()['content-type'],app.id).toContain('text/html');expect(await response.text(),app.id+' bootstrap').toContain('/world/universe/app-bootstrap.js');}
});
test('invalid child scope stays visible without inventing a replacement world',async({page})=>{await page.goto('/tools/worldline?tick=-1');await expect(page.getByRole('navigation',{name:'Connected universe'})).toContainText('Invalid world context');expect(new URL(page.url()).searchParams.get('tick')).toBe('-1');});
