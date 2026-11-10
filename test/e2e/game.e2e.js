import { test, expect } from '@playwright/test';

for (const path of ['/game/1']) {
  test(`${path} initializes the scene without browser errors`, async ({ page }) => {
    const errors = [];
    let joined = false;
    let sceneLoaded = false;

    // Startup must work with installed dependencies alone, even without CDN access.
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== new URL(test.info().project.use.baseURL).origin) {
        errors.push(`Unexpected external dependency: ${url.href}`);
        return route.abort();
      }
      return route.continue();
    });

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
      if (new URL(response.url()).pathname === '/api/scenes/1' && response.ok()) {
        sceneLoaded = true;
      }
    });
    page.on('websocket', socket => {
      socket.on('framereceived', ({ payload }) => {
        if (JSON.parse(payload.toString()).type === 'playerJoined') joined = true;
      });
      socket.on('socketerror', error => errors.push(String(error)));
    });

    const response = await page.goto(path);
    expect(response.status()).toBe(200);
    try {
      // Multiplayer connects only after Jolt, scene geometry and character exist.
      await expect.poll(() => {
        expect(errors, 'Browser startup errors').toEqual([]);
        return { joined, sceneLoaded };
      }).toEqual({ joined: true, sceneLoaded: true });
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
