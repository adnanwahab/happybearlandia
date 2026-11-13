import {test, expect} from '@playwright/test';

// Real APIs and engine; Canvas is an explicitly supported renderer, not a mock.
async function reachableControls(page, region) {
  const controls = region.locator('button:enabled:visible, select:enabled:visible, input:enabled:visible, summary:visible, a[href]:visible');
  for (const control of await controls.all()) {
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    const viewport = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    // WCAG 2.2 minimum target size; compact native checkbox has a label target.
    const target = await control.evaluate(element => {
      const node = element.type === 'checkbox' ? element.closest('label') : element;
      const rect = node.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return {width: rect.width, height: rect.height, receivesPointer: node === hit || node.contains(hit)};
    });
    expect(target.width).toBeGreaterThanOrEqual(24);
    expect(target.height).toBeGreaterThanOrEqual(24);
    expect(target.receivesPointer, await control.textContent()).toBe(true);
    await control.click({trial: true});
  }
}

for (const viewport of [{width:320,height:640}, {width:390,height:844}, {width:768,height:1024}]) {
  test(`flagship touch journey ${viewport.width}px`, async ({page}, info) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      if (location.pathname === '/world/future-machine.html') {
        const url = new URL(location.href);
        url.searchParams.set('renderer', 'canvas2d');
        history.replaceState(null, '', url);
      }
    });
    await page.goto('/');
    await page.getByRole('link', {name:'Play Demo', exact:true}).tap();
    await expect.poll(() => page.evaluate(() => window.futureMachine?.state.status), {timeout:90000}).toBe('ready');
    await expect.poll(() => page.evaluate(() => window.futureMachine?.stats.scene?.backend)).toBe('canvas2d');
    await page.getByRole('button', {name:'Pause demo', exact:true}).tap();
    const slider = page.getByTestId('future-machine-timeline');
    await slider.fill('16');
    await slider.dispatchEvent('input');
    await expect.poll(() => page.evaluate(() => window.futureMachine.state.month)).toBe(16);
    const setup = page.locator('.fm-setup');
    const timeline = page.getByRole('region', {name:'Shared timeline', exact:true});
    const story = page.getByRole('region', {name:'Recorded change story'});
    async function capture(region, name) {
      await reachableControls(page, region);
      await expect(region).toHaveScreenshot(`${viewport.width}-${name}.png`, {
        mask: [page.locator('.fm-share-link'), page.locator('[data-visual-run-id]')],
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    await capture(setup, 'menus');
    await capture(timeline, 'timeline');
    await page.getByRole('button', {name:'Difference-only', exact:true}).tap();
    await page.getByRole('button', {name:'WHY · Homes', exact:true}).tap();
    await story.getByRole('button', {
      name:'Recorded housing completion · plan · building-project-policy-1-0 · event 16-0 · Month 16',
      exact:true,
    }).tap();
    await expect(story).toContainText('PROJECT_COMPLETE');
    await expect(story).toContainText('building-project-policy-1-0');
    await expect(story).toContainText('24');
    // Wrap only the volatile saved-run identifier for screenshot masking.
    // The real identity remains in engine state and the provenance attachment.
    await story.evaluate(element => {
      const id = window.futureMachine.history.experimentId;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) if (walker.currentNode.textContent.includes(id)) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const parts = node.textContent.split(id);
        const fragment = document.createDocumentFragment();
        parts.forEach((part, index) => {
          if (index) {
            const span = document.createElement('span');
            span.dataset.visualRunId = '';
            span.textContent = id;
            fragment.append(span);
          }
          fragment.append(document.createTextNode(part));
        });
        node.replaceWith(fragment);
      }
    });
    await capture(story, 'inspector');
    await page.getByRole('button', {name:'Copy comparison link', exact:true}).tap();
    const shareLink = page.getByRole('link', {name:'Open comparison link'});
    await reachableControls(page, page.locator('.fm-ui > footer'));
    await shareLink.scrollIntoViewIfNeeded();
    await shareLink.click({trial:true});
    await expect(page.locator('.fm-ui > footer')).toHaveScreenshot(`${viewport.width}-share.png`);
    const shared = await shareLink.getAttribute('href');
    const provenance = await page.evaluate(() => {
      const {history:h, state:s} = window.futureMachine;
      return {seed:h.seed, modelVersion:h.modelVersion, recipe:h.recipe, runId:h.experimentId,
        initialHash:h.initialHash, month:s.month, metrics:s.diff.metrics, backend:window.futureMachine.stats.scene.backend};
    });
    expect(provenance.seed).toBe(42);
    expect(provenance.backend).toBe('canvas2d');
    expect(provenance.metrics.housingUnits.delta).toBe(24);
    await info.attach('run-provenance', {body:JSON.stringify({viewport, ...provenance}, null, 2), contentType:'application/json'});
    await page.goto(shared);
    await expect.poll(() => page.evaluate(() => window.futureMachine?.state.status), {timeout:90000}).toBe('ready');
    expect(await page.evaluate(() => ({month:window.futureMachine.state.month, metrics:window.futureMachine.state.diff.metrics})))
      .toEqual({month:16, metrics:provenance.metrics});
    expect(errors).toEqual([]);
  });
}
