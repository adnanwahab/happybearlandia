#!/usr/bin/env bun
// SHE-43: bounded header evidence, never a deployment or CDN configurator.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const auditVersion = 1;
export const probes = Object.freeze([
  { path: '/', kind: 'html' },
  { path: '/world/future-machine.html', kind: 'html' },
  { path: '/world/future-machine/main.js', kind: 'javascript' },
  { path: '/vendor/three/three.module.js', kind: 'javascript' },
  { path: '/vendor/jolt/jolt-physics.wasm-compat.js', kind: 'embedded-wasm-javascript' },
  { path: '/tools/lumen/addons/libs/basis/basis_transcoder.wasm', kind: 'wasm' },
  { path: '/data/screenshots/1.gif', kind: 'image' },
  { path: '/data/glb/poker_chair.glb', kind: 'model' },
  { path: '/game/main.js', kind: 'generated-javascript' },
  { path: '/api/health', kind: 'dynamic' },
  { path: '/api/ready', kind: 'dynamic' },
  { path: '/api/config', kind: 'dynamic' },
  { path: '/api/world-experiments', kind: 'dynamic' },
  { path: '/world/decision/store.js', kind: 'private-source-denial' },
  { path: '/world/%zz.js', kind: 'malformed-path-denial' },
  { path: '/missing-she43-cache-audit.js', kind: 'missing' },
]);
const selectedHeaders = ['cache-control', 'content-type', 'content-length', 'etag',
  'last-modified', 'expires', 'age', 'vary', 'content-encoding', 'via', 'server'];
const root = fileURLToPath(new URL('../', import.meta.url));
const safeGitEnv = { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
const maxBodyBytes = 32 * 1024 * 1024;

async function bodyDigest(response) {
  const hash = createHash('sha256');
  let bytes = 0;
  if (response.body) {
    const reader = response.body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBodyBytes) {
          await reader.cancel();
          const error = new Error('Response exceeds audit body limit');
          error.name = 'BodyLimitError';
          throw error;
        }
        hash.update(value);
      }
    } finally { reader.releaseLock(); }
  }
  return { bodyBytes: bytes, bodySha256: hash.digest('hex') };
}

export function loopbackOrigin(input) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Only a credential-free loopback origin is accepted; staging needs separate operator authorization.');
  }
  return url.origin;
}

export function assessHeaders({ kind, status, headers, expectedStatus }) {
  const control = (headers['cache-control'] || '').toLowerCase();
  const directives = control.split(',').map(value => value.trim());
  const issues = [];
  if (expectedStatus !== undefined && status !== expectedStatus) issues.push('unexpected-status');
  if (kind === 'dynamic' && !directives.includes('no-store')) issues.push('dynamic-no-store-missing');
  if (kind === 'html' && !directives.includes('no-store') && !directives.includes('no-cache')) {
    issues.push('html-freshness-unspecified');
  }
  if (directives.includes('immutable')) issues.push('immutable-needs-content-hash-and-publication-proof');
  if (status >= 400 && !directives.includes('no-store')) issues.push('error-cache-policy-unspecified');
  if (!control) issues.push('cache-policy-unspecified');
  return { directives, issues };
}

// Inventory tracked deployable source assets, not credentials, saves or node_modules.
// Counts describe candidate files, not proof that every file is publicly reachable.
export async function inventoryAssets(directory = root) {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: directory, encoding: 'utf8', env: safeGitEnv }).split('\0').filter(Boolean);
  const groups = { javascript: [], images: [], wasm: [], models: [], jsonData: [] };
  for (const path of files) {
    if (!/^(world|data|game|tools|visualizations)\//.test(path) && !path.startsWith('blog/dist/')) continue;
    const ext = extname(path).toLowerCase();
    const group = ['.js', '.mjs'].includes(ext) ? 'javascript'
      : ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif'].includes(ext) ? 'images'
      : ext === '.wasm' ? 'wasm' : ['.glb', '.gltf', '.obj'].includes(ext) ? 'models'
      : ext === '.json' ? 'jsonData' : null;
    if (!group) continue;
    const info = await lstat(join(directory, path));
    if (!info.isFile()) continue;
    groups[group].push({ path, bytes: info.size });
  }
  return Object.fromEntries(Object.entries(groups).map(([kind, entries]) => [kind, {
    count: entries.length, bytes: entries.reduce((sum, file) => sum + file.bytes, 0),
    samples: entries.slice(0, 5),
  }]));
}

export async function collectHeaders(origin, { fetcher = fetch } = {}) {
  const base = loopbackOrigin(origin);
  const rows = [];
  for (const probe of probes) {
    for (const method of ['GET', 'HEAD']) {
      const expectedStatus = ['private-source-denial', 'malformed-path-denial', 'missing'].includes(probe.kind)
        ? 404 : probe.path === '/api/world-experiments' && method === 'HEAD' ? 405 : 200;
      const row = { ...probe, method, expectedStatus };
      try {
        const response = await fetcher(new URL(probe.path, base), {
          method, redirect: 'error', signal: AbortSignal.timeout(10000),
          headers: { 'cache-control': 'no-cache' },
        });
        row.status = response.status;
        row.headers = Object.fromEntries(selectedHeaders.flatMap(key => response.headers.has(key) ? [[key, response.headers.get(key)]] : []));
        // Hash response content, but never retain bodies or arbitrary headers/cookies.
        Object.assign(row, await bodyDigest(response));
        row.assessment = assessHeaders(row);
      } catch (error) {
        // Do not echo URLs, response bodies, credential-bearing exception text or auth headers.
        row.error = error.name === 'TimeoutError' ? 'timeout' : error.name === 'BodyLimitError' ? 'body-limit-exceeded' : 'request-failed';
      }
      rows.push(row);
    }
  }
  return rows;
}

export async function startIsolatedServer(directory = root) {
  const temporary = await mkdtemp(join(tmpdir(), 'hbl-she43-cache-'));
  // Some legacy stores resolve paths relative to module URLs, not environment.
  // Export only committed source into a fresh directory so those writes are disposable too.
  const exported = join(temporary, 'source');
  await mkdir(exported);
  try {
    execFileSync('git', ['archive', '--format=tar', '--output=' + join(temporary, 'source.tar'), 'HEAD', '--', '.', ':(exclude).env*'],
      { cwd: directory, env: safeGitEnv });
    execFileSync('tar', ['-xf', join(temporary, 'source.tar'), '-C', exported], { env: safeGitEnv });
    await symlink(await realpath(join(directory, 'node_modules')), join(exported, 'node_modules'), 'dir');
  } catch {
    await rm(temporary, { recursive: true, force: true });
    throw new Error('Cannot export the committed candidate or find installed dependencies.');
  }
  const server = Bun.spawn([process.execPath, '--no-env-file', 'run', 'server.js'], {
    cwd: exported,
    env: { PATH: process.env.PATH, PORT: '0', HBL_WORLD_DB_PATH: ':memory:',
      DECISION_STORE_DIR: join(temporary, 'decision'), HBL_JOURNAL_ROOT: join(temporary, 'journals'),
      HBL_CITY_DATA_DIR: join(temporary, 'city'), HBL_REALITY_SHARE_DB_PATH: ':memory:' },
    stdout: 'pipe', stderr: 'pipe',
  });
  const timer = setTimeout(() => server.kill(), 15000);
  const reader = server.stdout.getReader();
  let startup = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error('Isolated server failed to start; inspect local dependencies and port permissions.');
      startup += new TextDecoder().decode(value);
      const port = startup.match(/HappyBearLandia running at http:\/\/localhost:(\d+)/)?.[1];
      if (port) return { origin: `http://127.0.0.1:${port}`, close: async () => {
        server.kill(); await server.exited; await rm(temporary, { recursive: true, force: true });
      } };
    }
  } catch (error) {
    server.kill(); await server.exited;
    await rm(temporary, { recursive: true, force: true });
    throw error;
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

export async function runLocalAudit(directory = root) {
  const server = await startIsolatedServer(directory);
  try {
    return {
      auditVersion, auditToolSha256: createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex'),
      observedAt: new Date().toISOString(), evidenceType: 'local-non-production',
      sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8', env: safeGitEnv }).trim(),
      runtime: { bun: Bun.version, platform: process.platform, arch: process.arch },
      origin: server.origin, stagingVerified: false,
      inventoryScope: 'Tracked source files in public-root candidates; excludes node_modules, untracked data and route-denied-file analysis.',
      inventory: await inventoryAssets(directory),
      responses: await collectHeaders(server.origin),
    };
  } finally { await server.close(); }
}

if (import.meta.main) {
  if (process.argv.length !== 2) {
    console.error('Usage: bun ops/static-asset-cache-audit.mjs (local isolated server only)');
    process.exitCode = 1;
  } else {
    try {
      const result = await runLocalAudit();
      console.log(JSON.stringify(result, null, 2));
      if (result.responses.some(row => row.error || row.assessment.issues.includes('unexpected-status') ||
          (row.kind === 'dynamic' && row.assessment.issues.includes('dynamic-no-store-missing')))) process.exitCode = 1;
    } catch (error) {
      console.error(error.message); process.exitCode = 1;
    }
  }
}
