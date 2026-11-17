import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runPlayer, compareReplay } from './lab.js';
const [mode = 'run', argument = '2911', output = '/tmp/hbl-player-lab'] = process.argv.slice(2);
if (!['run', 'replay'].includes(mode)) throw new Error('Usage: bun tools/player-lab/run.js run SEED OUTPUT | replay RECORD OUTPUT');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const hash = createHash('sha256').update(execFileSync('git', ['diff', 'HEAD', '--binary']));
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', 'tools/player-lab'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort();
for (const file of untracked) hash.update(file).update(await readFile(file));
const revision = head + ':' + hash.digest('hex');
const recorded = mode === 'replay' ? JSON.parse(await readFile(argument, 'utf8')) : null;
if (recorded && recorded.revision !== revision) throw new Error('Check out the recorded source revision before replay');
const scenarios = recorded ? [recorded.scenario] : ['first-play', 'last-chance', 'too-late', 'invalid-share'].map(strategy => ({ seed: Number(argument), strategy }));
const { chromium } = await import('@playwright/test');
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
let failed = false;
try {
  await mkdir(output, { recursive: true });
  for (const scenario of scenarios) {
    const context = await browser.newContext({ baseURL: process.env.HBL_PLAYER_LAB_URL || 'http://127.0.0.1:3100', locale: 'en-US', timezoneId: 'UTC' });
    await context.tracing.start({ screenshots: true, snapshots: true });
    try {
      const run = await runPlayer(await context.newPage(), scenario, revision);
      const name = `${scenario.strategy}-${scenario.seed}`;
      await context.tracing.stop({ path: `${output}/${name}.zip` });
      await writeFile(`${output}/${name}.json`, JSON.stringify(run, null, 2));
      const matches = recorded ? compareReplay(recorded, run) : null;
      failed ||= run.status !== 'passed' || matches === false;
      console.log(JSON.stringify({ name, status: run.status, replayMatches: matches }));
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
process.exitCode = failed ? 1 : 0;
