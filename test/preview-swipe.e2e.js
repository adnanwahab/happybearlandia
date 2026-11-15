import {test,expect} from '@playwright/test';
for (const reducedMotion of ['no-preference','reduce']) test(`bounded preview interactions: ${reducedMotion}`,async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion});
  // Disposable previews isolate carousel behavior from heavyweight model/network work.
  await page.route('**/*',route=>route.request().isNavigationRequest() && route.request().frame().parentFrame()?route.fulfill({contentType:'text/html',body:'<canvas tabindex="0"></canvas>'}):route.continue());
  await page.goto('/');const rail=page.locator('#carousel-rail');await rail.scrollIntoViewIfNeeded();
  await expect(page.locator('.gallery-card')).toHaveCount(33);
  await rail.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#carousel-prev')).toHaveAttribute('aria-disabled','true');
  const drag=async(dx,dy=0,cancel=false)=>{
    const card=page.locator('.gallery-card.is-current .gallery-viewport');
    const box=await card.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+30);await page.mouse.down();
    await page.mouse.move(box.x+box.width/2+dx,box.y+30+dy,{steps:8});
    if(cancel)await rail.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();
  };
  await drag(-100);await expect(page.locator('#carousel-status')).toHaveText('2 / 33');
  await expect(page).toHaveURL(/\/$/);
  await rail.focus();await page.keyboard.press('End');await expect(page.locator('#carousel-next')).toHaveAttribute('aria-disabled','true');
  await page.keyboard.press('ArrowRight');await expect(page.locator('#carousel-status')).toHaveText('33 / 33');await expect(rail).toBeFocused();
  await page.keyboard.press('Home');await expect(page.locator('#carousel-status')).toHaveText('1 / 33');
  if(reducedMotion==='reduce')await expect(page.locator('.gallery-card').first()).toHaveCSS('transform','none');
  await page.locator('.gallery-card.is-current footer button').click();
  await expect(page.locator('.gallery-card.is-current')).toHaveClass(/is-interactive/);
  const before = await rail.evaluate(el=>el.scrollLeft);
  await drag(-100);
  await expect.poll(()=>rail.evaluate(el=>el.scrollLeft)).toBe(before);
  await page.locator('#carousel-category').selectOption('games');
  await expect(page.locator('#carousel-prev')).toHaveAttribute('aria-disabled','true');
  await expect(page.locator('.gallery-card.is-interactive')).toHaveCount(0);
  await page.screenshot({path:`.mini-symphony-evidence/SHE-441-after-mobile-${reducedMotion}.png`});
});

test('native touch swipe keeps navigation local',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/*',route=>route.request().isNavigationRequest() && route.request().frame().parentFrame()?route.fulfill({contentType:'text/html',body:'<canvas></canvas>'}):route.continue());
  await page.goto('/');const rail=page.locator('#carousel-rail');await rail.scrollIntoViewIfNeeded();
  await expect(page.locator('.gallery-card')).toHaveCount(33);
  const session=await context.newCDPSession(page);
  const box=await page.locator('.gallery-card.is-current .gallery-viewport').boundingBox();
  const x=box.x+box.width/2,y=box.y+30;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-110,y}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('#carousel-status')).toHaveText('2 / 33');await expect(page).toHaveURL(/\/$/);
});
