import { expect, test } from 'bun:test';
import { classifyAudit, lockedInventory, browserInventory, collectAudit } from '../ops/dependency-browser-audit.mjs';

test('an empty successful advisory response is scoped evidence, never a vulnerability-free certification', () => {
  expect(classifyAudit({ exitCode: 0, stdout: '{}' })).toEqual({ status: 'no-advisories-returned', advisories: [] });
});

test('network errors, non-report JSON and contradictory exit codes fail closed', () => {
  for (const input of [
    { exitCode: 1, stdout: '' }, { exitCode: 1, stdout: '{}' },
    { exitCode: 0, stdout: '<html>proxy failure</html>' },
    { exitCode: 0, stdout: '{"error":"registry unavailable"}' },
    { exitCode: 0, stdout: '[]' }, { exitCode: 0, stdout: 'null' },
  ]) expect(classifyAudit(input).status).toBe('unavailable');
});

test('advisories retain package, severity and range without claiming a confirmed application exploit', () => {
  const stdout = JSON.stringify({ fixture: [{ id: 42, title: 'Fixture advisory', severity: 'high', vulnerable_versions: '<2', url: 'https://example.invalid/42' }] });
  const report = classifyAudit({ exitCode: 1, stdout });
  expect(report.status).toBe('advisories-returned');
  expect(report.advisories[0]).toMatchObject({ package: 'fixture', severity: 'high', vulnerableRange: '<2' });
  expect(report.advisories[0].classification).toContain('exploitability-not-established');
  expect(classifyAudit({ exitCode: 0, stdout }).status).toBe('unavailable');
});

test('direct and dev dependencies use exact locked versions, including scoped names', () => {
  const manifest = { dependencies: { '@fixture/runtime': '^2' }, devDependencies: { runner: '^3' } };
  const lock = { packages: { '@fixture/runtime': ['@fixture/runtime@2.4.1'], runner: ['runner@3.1.2'] } };
  expect(lockedInventory(manifest, lock)).toEqual([
    { name: '@fixture/runtime', group: 'dependencies', requested: '^2', locked: '2.4.1' },
    { name: 'runner', group: 'devDependencies', requested: '^3', locked: '3.1.2' },
  ]);
  expect(() => lockedInventory(manifest, { packages: {} })).toThrow('Unresolved direct dependency');
});

test('missing engines remain not-run and WebKit inventory never claims Safari validation', async () => {
  const playwright = Object.fromEntries(['chromium', 'firefox', 'webkit'].map(name => [name, { executablePath: () => `/nonexistent-she61/${name}` }]));
  const browsers = await browserInventory(playwright);
  expect(browsers.every(x => !x.expectedExecutablePresent && x.validation === 'not-run-by-inventory')).toBe(true);
  expect(browsers[2].limitation).toContain('not installed Safari');
});


test('registry subprocess deadline kills a real stalled child even after it emits empty valid JSON', async () => {
  const child = Bun.spawn([process.execPath, '-e', 'console.log("{}"); setInterval(() => {}, 1000);'], {
    env: { PATH: process.env.PATH }, stdout: 'pipe', stderr: 'pipe',
  });
  const started = performance.now();
  const result = await collectAudit(child, 30);
  expect(result.timedOut).toBe(true);
  expect(result.exitCode).not.toBe(0);
  expect(performance.now() - started).toBeLessThan(2000);
});
