// Tooling tests only. Stub runner output is never application/browser evidence.
import { test, expect } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve(import.meta.dir, '../../../scripts/record-one-city-two-futures.mjs');
test('recording CLI rejects invalid ports and unknown arguments before launch', () => {
  for (const args of [['--port', '0'], ['--port', '65536'], ['--unknown']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage:');
  }
});

for (const mode of ['missing artifacts', 'missing video', 'empty video', 'corrupt video']) {
  test(`runner exit zero cannot report success with ${mode}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'she71-command-test-'));
    try {
      const bin = join(root, 'bin'), output = join(root, 'output');
      await mkdir(bin); await mkdir(output);
      await writeFile(join(bin, 'bunx'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
      if (mode !== 'missing artifacts') {
        for (const name of ['scenario.json', 'metrics.json', 'month-0.png', 'first-divergence.png', 'why-open.png', 'canvas2d.png', 'trace.zip']) {
          await writeFile(join(output, name), 'Synthetic validator test; not browser evidence.');
        }
      }
      if (mode === 'empty video' || mode === 'corrupt video') {
        await writeFile(join(output, 'video.webm'), mode === 'empty video' ? '' : 'invalid webm');
      }
      const result = spawnSync(process.execPath, [script, '--output', output], {
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stdout).not.toContain('Recording acceptance passed');
      expect(result.stderr).toContain({
        'missing artifacts': 'Missing required recording artifact',
        'missing video': 'no finalized WebM video',
        'empty video': 'Empty video',
        'corrupt video': 'Video decode failed',
      }[mode]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}
