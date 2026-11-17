import { expect, test } from 'bun:test';
import { checkPreview } from '../scripts/generate-social-preview';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('committed social assets fully decode and meet format, silence, dimensions and size budgets', async () => {
  await checkPreview();
}, 30_000);

test('generator reports unavailable inputs without overwriting committed media', async () => {
  const before = Bun.hash(await Bun.file('preview.mp4').arrayBuffer());
  const child = Bun.spawn([process.execPath, 'scripts/generate-social-preview.ts', '/nonexistent/hbl-preview.mp4'], { stdout: 'pipe', stderr: 'pipe' });
  expect(await child.exited).toBe(1);
  expect(await new Response(child.stderr).text()).toContain('Input video unavailable');
  expect(Bun.hash(await Bun.file('preview.mp4').arrayBuffer())).toBe(before);
});

test('generator clearly reports missing FFmpeg', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/generate-social-preview.ts', '--check'], { env: { PATH: '' }, stdout: 'pipe', stderr: 'pipe' });
  expect(await child.exited).toBe(1);
  expect(await new Response(child.stderr).text()).toContain('ffmpeg is required');
});

test('real server exposes exact preview URLs and homepage metadata without opening arbitrary files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hbl-social-http-'));
  const server = Bun.spawn([process.execPath, '--no-env-file', 'server.js'], {
    env: { ...process.env, PORT: '0', HBL_WORLD_DB_PATH: ':memory:', HBL_GUEST_DB_PATH: join(dir, 'guest.sqlite'), HBL_CITY_DATA_DIR: join(dir, 'city'), HBL_REALITY_SHARE_DB_PATH: join(dir, 'share.sqlite'), DECISION_STORE_DIR: join(dir, 'decision'), HBL_JOURNAL_ROOT: join(dir, 'journals') },
    stdout: 'pipe', stderr: 'pipe',
  });
  const timer = setTimeout(() => server.kill(), 15_000);
  try {
    const reader = server.stdout.getReader();
    let text = '', port;
    while (!port) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error('Server failed: ' + await new Response(server.stderr).text());
      text += new TextDecoder().decode(chunk.value);
      port = text.match(/running at http:\/\/localhost:(\d+)/)?.[1];
    }
    reader.releaseLock();
    const origin = `http://127.0.0.1:${port}`;
    const home = await fetch(origin);
    expect(home.status).toBe(200);
    const html = await home.text();
    for (const [attribute, key, value] of [
      ['property', 'og:title', 'HappyBearLandia — Explore Possible Futures'],
      ['property', 'og:description', 'Build a world. Change the rules. See what happens.'],
      ['property', 'og:image', 'https://happybearlandia.fly.dev/preview.jpg'],
      ['property', 'og:video', 'https://happybearlandia.fly.dev/preview.mp4'],
      ['property', 'og:video:type', 'video/mp4'],
      ['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630'],
      ['name', 'twitter:card', 'summary_large_image'],
      ['name', 'twitter:image', 'https://happybearlandia.fly.dev/preview.jpg'],
    ]) expect(html).toContain(`<meta ${attribute}="${key}" content="${value}">`);
    for (const [name, type] of [['preview.mp4', 'video/mp4'], ['preview.jpg', 'image/jpeg']]) {
      const response = await fetch(`${origin}/${name}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe(type);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(await Bun.file(name).arrayBuffer()));
      const head = await fetch(`${origin}/${name}`, { method: 'HEAD' });
      expect(head.status).toBe(200);
      expect(head.headers.get('content-type')).toBe(type);
      expect((await head.arrayBuffer()).byteLength).toBe(0);
    }
    for (const path of ['/.env', '/preview.ts', '/preview.mp4/private']) expect((await fetch(origin + path)).status).toBe(404);
  } finally { clearTimeout(timer); server.kill(); await server.exited; await rm(dir, { recursive: true, force: true }); }
}, 20_000);
