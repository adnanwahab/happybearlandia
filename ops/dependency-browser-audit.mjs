#!/usr/bin/env bun
// Read-only advisory/inventory audit. Never installs or applies fixes.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function classifyAudit({ exitCode, stdout }) {
  let report;
  try { report = JSON.parse(stdout); } catch { return { status: 'unavailable', reason: 'invalid-or-missing-json', advisories: [] }; }
  if (!report || Array.isArray(report) || typeof report !== 'object' ||
      !Object.values(report).every(rows => Array.isArray(rows) && rows.every(row =>
        row && typeof row === 'object' && typeof row.title === 'string' &&
        ['low', 'moderate', 'high', 'critical'].includes(row.severity)))) {
    return { status: 'unavailable', reason: 'unrecognized-advisory-report', advisories: [] };
  }
  const advisories = Object.entries(report).flatMap(([name, rows]) => rows.map(row => ({
    package: name, title: row.title, severity: row.severity,
    id: row.id ?? null, url: row.url ?? null, vulnerableRange: row.vulnerable_versions ?? null,
    classification: 'registry-advisory; application-exploitability-not-established',
  })));
  if ((exitCode === 0 && advisories.length) || (exitCode !== 0 && !(exitCode === 1 && advisories.length))) {
    return { status: 'unavailable', reason: 'exit-and-report-disagree', advisories };
  }
  return { status: advisories.length ? 'advisories-returned' : 'no-advisories-returned', advisories };
}

export function lockedInventory(manifest, lock) {
  if (!lock?.packages || typeof lock.packages !== 'object') throw Error('Missing lock package inventory');
  return ['dependencies', 'devDependencies'].flatMap(group => Object.entries(manifest[group] || {}).map(([name, range]) => {
    const specifier = lock.packages[name]?.[0];
    if (typeof specifier !== 'string' || !specifier.startsWith(name + '@')) throw Error(`Unresolved direct dependency ${name}`);
    return { name, group, requested: range, locked: specifier.slice(name.length + 1) };
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function browserInventory(playwright) {
  return ['chromium', 'firefox', 'webkit'].map(name => {
    const executable = playwright[name].executablePath();
    return { engine: name, expectedExecutablePresent: existsSync(executable),
      validation: 'not-run-by-inventory',
      limitation: name === 'webkit' ? 'Playwright WebKit is not installed Safari or a physical iOS device' : 'Presence does not establish application support' };
  });
}

export async function collectAudit(child, timeoutMs = 30_000) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw Error('Audit timeout must be 1–60000ms');
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
    ]);
    return { stdout, stderrPresent: Boolean(stderr.trim()), exitCode, timedOut };
  } finally { clearTimeout(timer); }
}

export async function audit(root = process.cwd()) {
  const text = readFileSync(resolve(root, 'bun.lock'), 'utf8');
  const manifestText = readFileSync(resolve(root, 'package.json'), 'utf8');
  const lock = Bun.JSONC.parse(text);
  const child = Bun.spawn([process.execPath, 'audit', '--json'], { cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NO_COLOR: '1' }, stdout: 'pipe', stderr: 'pipe' });
  const { stdout, stderrPresent, exitCode, timedOut } = await collectAudit(child);
  const result = timedOut ? { status: 'unavailable', reason: 'audit-timeout', advisories: [] } : classifyAudit({ stdout, exitCode });
  // Do not persist raw stderr, registry config or credentials in committed evidence.
  const digest = value => createHash('sha256').update(value).digest('hex');
  const unchanged = text === readFileSync(resolve(root, 'bun.lock'), 'utf8') &&
    manifestText === readFileSync(resolve(root, 'package.json'), 'utf8');
  if (!unchanged) throw Error('Manifest or lock changed during read-only audit');
  let browsers;
  try { browsers = await browserInventory(await import('@playwright/test')); }
  catch { browsers = { status: 'unavailable', reason: 'Playwright package unavailable; no engine claim' }; }
  return {
    schemaVersion: 1, observedAt: new Date().toISOString(),
    runtime: { bun: Bun.version, platform: process.platform, architecture: process.arch },
    source: { command: 'bun audit --json', endpoint: 'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk',
      lockSha256: digest(text), manifestSha256: digest(manifestText), lockUnchanged: unchanged, registryExitCode: exitCode,
      stderrPresent, timedOut, timeoutMs: 30_000 },
    dependencies: lockedInventory(JSON.parse(manifestText), lock), lockedPackageEntries: Object.keys(lock.packages).length,
    advisoryAudit: result, browsers,
    confirmedApplicationVulnerabilities: [],
    limitations: [
      'Registry data is time-dependent and may omit undisclosed or unreported vulnerabilities.',
      'No application exploitability test was performed; zero returned advisories is not a security certification.',
      'Browser inventory checks expected executable presence only; application journey evidence is recorded separately.',
      'No dependencies, lockfile, browser binaries, CI coverage or production configuration are changed.',
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 0 && !(args.length === 2 && args[0] === '--output')) {
    console.error('Usage: bun ops/dependency-browser-audit.mjs [--output <new-report.json>]');
    process.exitCode = 2;
  } else {
    try {
      const report = await audit();
      const output = JSON.stringify(report, null, 2) + '\n';
      if (args[0] === '--output') writeFileSync(args[1], output, { flag: 'wx' });
      else console.log(output);
      process.exitCode = report.advisoryAudit.status === 'unavailable' ? 2 : report.advisoryAudit.advisories.length ? 1 : 0;
    } catch (error) {
      console.error('Audit did not complete:', error.message);
      process.exitCode = 2;
    }
  }
}
