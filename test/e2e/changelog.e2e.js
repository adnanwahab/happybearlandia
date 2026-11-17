import {test,expect} from '@playwright/test';
// Synthetic test evidence only; never included in the public manifest.
function fixture() {
  const commit='a'.repeat(40);
  return {schemaVersion:1,entries:[{title:'<img src=x onerror=alert(1)>',summary:'Synthetic test fixture only.',pr:{number:123,mergedAt:'2026-01-01T00:00:00Z',mergeCommit:commit,url:'https://github.com/adnanwahab/happybearlandia/pull/123'},deployment:{version:commit,commit,deployedAt:'2026-01-02T00:00:00Z',verified:true,versionUrl:`https://github.com/adnanwahab/happybearlandia/commit/${commit}`,evidenceUrl:'https://github.com/adnanwahab/happybearlandia/actions/runs/123'}}]};
}
test('normal Tools entry shows honest empty state and responsive accessible page', async ({page}) => {
  await page.goto('/tools/',{waitUntil:'domcontentloaded'});
  await page.getByRole('link',{name:'Release changelog',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Release changelog',exact:true})).toBeVisible();
  await expect(page.getByRole('status')).toContainText('No verified deployed releases yet');
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await page.screenshot({path:'docs/images/she121-changelog.png',fullPage:true});
  await page.setViewportSize({width:320,height:700});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('link',{name:'All tools'}).focus();
  await expect(page.getByRole('link',{name:'All tools'})).toBeFocused();
});
test('renders synthetic verified evidence as text and rejects unverified records', async ({page}) => {
  const data=fixture(); const bad=structuredClone(data.entries[0]);bad.deployment.verified=false;data.entries.push(bad);
  await page.route('**/data/changelog.json',r=>r.fulfill({json:data}));
  await page.goto('/tools/release-changelog.html');
  await expect(page.getByRole('status')).toHaveText('1 verified release.');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('heading',{level:2})).toHaveText(data.entries[0].title);
  await expect(page.locator('main img')).toHaveCount(0);
  for(const [name,href] of [['Merged PR #123',data.entries[0].pr.url],['Deployment evidence',data.entries[0].deployment.evidenceUrl],[`Deployed version ${'a'.repeat(40)}`,data.entries[0].deployment.versionUrl]]) await expect(page.getByRole('link',{name,exact:true})).toHaveAttribute('href',href);
});
for(const mode of ['http','malformed','schema','oversize','network']) test(`explicit unavailable state: ${mode}`,async ({page})=>{
  await page.route('**/data/changelog.json',r=>mode==='network'?r.abort():r.fulfill({status:mode==='http'?503:200,body:mode==='malformed'?'{':mode==='oversize'?' '.repeat(65537):JSON.stringify({schemaVersion:99,entries:[]}),contentType:'application/json'}));
  await page.goto('/tools/release-changelog.html');
  await expect(page.getByRole('status')).toContainText('Release notes unavailable');
  await expect(page.getByRole('listitem')).toHaveCount(0);
});
