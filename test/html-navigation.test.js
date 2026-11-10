import { describe, test, expect } from 'bun:test';
import { EXPERIENCES } from '../world/universe/registry.js';
import { BOOTSTRAP_PATH, registeredHTMLFiles, experienceFromLocation, injectUniverseBootstrap, withUniverseNavigation } from '../world/universe/html-navigation.js';

describe('registered experience HTML integration', () => {
  test('every registered route resolves its own experience, including shared documents', () => {
    for (const app of EXPERIENCES) expect(experienceFromLocation(app.route)?.id).toBe(app.id);
    expect(experienceFromLocation('/world/index.html?living=1&embed=1').id).toBe('living-city');
    expect(experienceFromLocation('/world/?living=0').id).toBe('world');
    expect(experienceFromLocation('/world/decision.html?runId=x#advanced').id).toBe('optimization');
  });
  test('registered documents exist and receive exactly one bootstrap', async () => {
    for (const path of registeredHTMLFiles()) {
      const file = Bun.file(path);
      expect(await file.exists()).toBe(true);
      const html = injectUniverseBootstrap(await file.text(), path);
      expect(html.split(`src="${BOOTSTRAP_PATH}"`).length - 1).toBe(1);
      expect(injectUniverseBootstrap(html, path)).toBe(html);
    }
  });
  test('server aliases and direct HTML entries identify their experience', () => {
    for (const [path, id] of [
      ['/tools/flower.html', 'flower'], ['/tools/lumen/index.html', 'lumen'],
      ['/world/house/family_1', 'house'], ['/world/house/index.html', 'house'],
      ['/world/party/act-normal.html', 'act-normal'], ['/game/1', 'game'],
      ['/world/visualize-consitution', 'constitution-city'],
      ['/world/constitution-city.html', 'dear-congress'],
      ['/world/reality-compiler.html', 'experiments'], ['/change', 'experiments'],
      ['/r/Abcd1234', 'experiments'], ['/world/business.html', 'business'],
      ['/world/bench/downtown', 'world'],
    ]) expect(experienceFromLocation(path)?.id).toBe(id);
  });
  test('unsupported routes and shell are not mislabeled or transformed', () => {
    for (const path of ['/', '/?app=world', '/index.html', '/blog', '/tools', '/tools/twitch-plays-robot', '/world/not-real', '/world/universe/navigation.js', '/world/%zz']) {
      expect(experienceFromLocation(path)).toBeNull();
    }
    const source = '<body>unchanged</body>';
    for (const path of ['index.html', 'tools/index.html', 'world/universe/navigation.js', 'tools/lumen/three.module.js', 'blog/dist/index.html']) expect(injectUniverseBootstrap(source, path)).toBe(source);
  });
  test('Bun file responses retain HTML MIME after conversion to text', async () => {
    const result = await withUniverseNavigation(new Response(Bun.file('world/index.html')), 'world/index.html');
    expect(result.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await result.text()).toContain(BOOTSTRAP_PATH);
  });
  test('response transform preserves status, content type and cache headers', async () => {
    const response = new Response('<html><body>hello</body></html>', { status: 200, statusText: 'Original', headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', 'x-original': 'yes', 'content-length': '44' } });
    const result = await withUniverseNavigation(response, 'world/index.html');
    expect(result.status).toBe(200);
    expect(result.statusText).toBe('Original');
    expect(result.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(result.headers.get('cache-control')).toBe('no-cache');
    expect(result.headers.get('x-original')).toBe('yes');
    expect(result.headers.has('content-length')).toBe(false);
    expect(await result.text()).toContain(BOOTSTRAP_PATH);
    for (const [status, path] of [[404, 'world/index.html'], [200, 'world/universe/navigation.js']]) {
      const untouched = new Response('original', { status });
      expect(await withUniverseNavigation(untouched, path)).toBe(untouched);
    }
  });
});
