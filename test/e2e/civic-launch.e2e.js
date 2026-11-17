import {test,expect} from '@playwright/test';
const context='civicContext=1&proposalId=demo-law-83&revision=2&lawId=83&implementationStrength=0.5&seed=42&population=24';
test('public Civic recipe opens exact bounded real worker playback and safe return link',async({page})=>{
 await page.setViewportSize({width:320,height:780});await page.emulateMedia({reducedMotion:'reduce'});
 // Exercise real deterministic geography fallback; no modeled receipt or worker result is mocked.
 await page.route('**/api/area?**',route=>route.abort());
 await page.goto('/world/constitution-city.html?'+context);
 const panel=page.getByTestId('law-panel');await expect(panel).toBeVisible({timeout:45000});
 const viewer=page.getByTestId('law-behavior-playback');await expect(viewer).toBeVisible({timeout:45000});
 await expect(panel.getByLabel('Implementation strength percent')).toHaveValue('50');
 const result=await page.evaluate(()=>window.hblConstitutionCity.lawPanel.getComparison());
 expect(result.manifest.seed).toBe(42);expect(result.manifest.population).toBe(24);
 expect(result.manifest.implementationStrength).toBe(.5);expect(result.manifest.selectedConfig.transitService).toBe(1.25);
 expect(result.baseline.timeline.at(-1).minute).toBe(720);
 const link=panel.getByTestId('law-civic-link');await expect(link).toBeVisible();
 const returned=new URL(await link.getAttribute('href'));expect(returned.origin).toBe('https://civic-synthesis.fly.dev');
 expect(returned.searchParams.get('revision')).toBe('2');expect(returned.searchParams.get('seed')).toBe('42');
 await panel.getByLabel('Implementation strength percent').fill('100');
 await panel.getByLabel('Implementation strength percent').dispatchEvent('change');
 await expect.poll(async()=>new URL(await link.getAttribute('href')).searchParams.get('implementationStrength')).toBe('1');
 expect(new URL(await link.getAttribute('href')).searchParams.get('revision')).toBe('3');
 const rerun=await page.evaluate(()=>window.hblConstitutionCity.lawPanel.getComparison());expect(rerun.baseline.timeline).toEqual(result.baseline.timeline);
 await viewer.getByLabel('Recorded simulation checkpoint').fill('0');await viewer.getByLabel('Recorded simulation checkpoint').dispatchEvent('input');
 await expect(viewer.locator('.law-behavior-clock')).toContainText('Minute 0');
 await expect(viewer.locator('iframe,img')).toHaveCount(0);
 await expect.poll(()=>panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await viewer.scrollIntoViewIfNeeded();await viewer.screenshot({path:test.info().outputPath('civic-law-83-mobile.png')});
});
test('version mismatch fails explicitly without exposing replacement playback',async({page})=>{
 await page.route('**/api/area?**',route=>route.abort());
 await page.goto('/world/constitution-city.html?'+context+'&modelVersion=unavailable.v0');
 const panel=page.getByTestId('law-panel');await expect(panel.locator('p[role=status]')).toContainText('Model version mismatch',{timeout:45000});
 await expect(page.getByTestId('law-behavior-playback')).toBeHidden();await expect(panel.getByTestId('law-civic-link')).toBeHidden();
});

test('unsupported public recipe does not silently run a different scenario',async({page})=>{
 const runs=[];page.on('request',request=>{if(request.url().includes('comparison.worker'))runs.push(request.url());});
 await page.goto('/world/constitution-city.html?'+context.replace('lawId=83','lawId=31'));
 await expect(page.locator('#cc-load-status')).toContainText('Invalid or unsupported public scenario context');
 await expect(page.getByTestId('law-panel')).toHaveCount(0);expect(runs).toEqual([]);
});
