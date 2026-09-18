import { test, expect } from '@playwright/test';

for (const path of ['/game', '/game/']) {
  test(`${path} initializes the scene without browser errors`, async ({ page }) => {
    const errors = [];
    let welcomed = false;
    let sceneLoaded = false;

    // Register before navigating so module/WASM and early startup failures count.
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('requestfailed', request => {
      errors.push(`${request.url()}: ${request.failure()?.errorText}`);
    });
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
      if (new URL(response.url()).pathname === '/game/scene.json' && response.ok()) {
        sceneLoaded = true;
      }
    });
    page.on('websocket', socket => {
      socket.on('framereceived', ({ payload }) => {
        if (JSON.parse(payload.toString()).type === 'welcome') welcomed = true;
      });
      socket.on('socketerror', error => errors.push(String(error)));
    });

    const response = await page.goto(path);
    expect(response.status()).toBe(200);
    try {
      // Multiplayer connects only after Jolt, scene geometry and character exist.
      await expect.poll(() => {
        expect(errors, 'Browser startup errors').toEqual([]);
        return { welcomed, sceneLoaded };
      }).toEqual({ welcomed: true, sceneLoaded: true });
      await expect(page.locator('#container canvas')).toBeVisible();
      await expect(page.locator('#container')).not.toContainText('Unable to start game');

      // Exercise several animation/physics updates after initialization.
      await page.evaluate(async () => {
        for (let frame = 0; frame < 10; frame++) {
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
      });
      expect(errors, 'Browser runtime and resource errors').toEqual([]);
    } finally {
      await test.info().attach('browser-errors', {
        body: JSON.stringify(errors, null, 2),
        contentType: 'application/json',
      });
    }
  });
}
