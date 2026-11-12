import { test, expect } from '@playwright/test';
import { collectBrowserEvidence } from '../helpers/browser-evidence.js';

for (const path of ['/game/1']) {
  test(`${path} initializes the scene without browser errors`, async ({ page }) => {
    const evidence = collectBrowserEvidence(page);
    const errors = evidence.events;
    let joined = false;
    let sceneLoaded = false;

    // Startup must work with installed dependencies alone, even without CDN access.
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== new URL(test.info().project.use.baseURL).origin) {
        evidence.record('external-dependency', url.href);
        return route.abort();
      }
      return route.continue();
    });

    page.on('response', response => {
      if (new URL(response.url()).pathname === '/api/scenes/1' && response.ok()) sceneLoaded = true;
    });
    page.on('websocket', socket => {
      socket.on('framereceived', ({ payload }) => {
        if (JSON.parse(payload.toString()).type === 'playerJoined') joined = true;
      });
      socket.on('socketerror', error => evidence.record('websocket', error));
    });

    try {
      const response = await page.goto(path);
      expect(response.status()).toBe(200);
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
      await evidence.attach(test.info());
      evidence.dispose();
    }
  });
}
