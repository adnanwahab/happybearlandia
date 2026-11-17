import {test,expect} from '@playwright/test';
for(const [name,route] of [['home','/'],['future','/world/future-machine.html?renderer=canvas'],['decision','/world/decision.html']]) {
 test(`${name}: keyboard inspector, tokens and live reduced motion`,async({page},info)=>{
  await page.goto(route);
  const panel=page.locator('[data-motion-inspector]'),summary=panel.locator('summary');
  await expect(summary).toBeVisible();await summary.focus();await page.keyboard.press('Enter');await expect(panel).toHaveAttribute('open','');
  const preview=panel.getByRole('button',{name:'Preview transition'});await preview.focus();await page.keyboard.press('Enter');await expect(panel.getByRole('status')).toContainText('preview 1');await expect(preview).toBeFocused();
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--hbl-duration-feedback').trim())).toBe('180ms');
  await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('html')).toHaveAttribute('data-hbl-reduced-motion','');await expect(panel.getByRole('checkbox')).toBeChecked();
  await page.keyboard.press('Escape');await expect(summary).toBeFocused();await expect(panel).not.toHaveAttribute('open','');
  await page.screenshot({path:info.outputPath(`${name}-after-desktop.png`),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:info.outputPath(`${name}-after-mobile.png`),fullPage:true});
 });
}
