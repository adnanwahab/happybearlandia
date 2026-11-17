import { test, expect } from '@playwright/test';
test('Research entry, actual housing run, evidence links, export and narrow layout', async ({page}) => {
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/world/research/');
  await page.getByRole('link',{name:'Enter the Reality Calibration Lab'}).click();
  await expect(page.getByRole('heading',{name:'Reality Calibration Lab',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Load synthetic example'}).click();
  await page.getByRole('button',{name:'Run backtest'}).click();
  await expect(page.getByRole('heading',{name:'Held-out validation · synthetic fitted outcomes'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Verification',exact:true})).toBeVisible();
  await expect(page.getByText('Synthetic holdout only:',{exact:false})).toBeVisible();
  await page.getByRole('link',{name:'demo-response',exact:true}).click();
  await expect(page.locator('#evidence-demo-response')).toBeInViewport();
  const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download report'}).click();
  expect((await downloading).suggestedFilename()).toBe('calibration-report.json');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('invalid imports clear prior results', async ({page}) => {
  await page.goto('/world/calibration/');
  await page.getByRole('button',{name:'Load synthetic example'}).click();
  await page.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":"wrong"}')});
  await expect(page.getByRole('status')).toContainText('Unsupported recipe version');
  await expect(page.getByRole('button',{name:'Run backtest'})).toBeDisabled();
});
