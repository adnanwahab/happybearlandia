// Scripted players exercise public controls; they do not estimate human enjoyment.
export const LAB_VERSION = 'player-lab.v1';
export function plan(seed, strategy) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be a uint32');
  if (!['first-play', 'last-chance', 'too-late', 'invalid-share'].includes(strategy)) throw new Error('Unknown strategy');
  const month = strategy === 'last-chance' ? 73 + seed % 2 : strategy === 'too-late' ? 75 + seed % 166 : 72;
  return { seed, strategy, month, model: 'bakery-v1', modelSeed: 2911 };
}
export async function snapshot(page) {
  return page.evaluate(() => {
    const text = id => document.getElementById(id)?.textContent.trim() ?? null;
    return { path: location.pathname + location.search, month: document.getElementById('month')?.value ?? null,
      scene: text('scene-status'), status: text('experiment-status'), metrics: text('metrics'),
      outcome: text('case-outcome'), evidence: text('why'),
      recipe: (() => { const value = document.getElementById('recipe-link')?.value;
        return value ? new URL(value).search : null; })() };
  });
}
export async function runPlayer(page, input, revision) {
  const scenario = plan(input.seed, input.strategy);
  const run = { version: LAB_VERSION, revision, scenario, assumptions: 'Scripted policy; synthetic bakery fixture; seed chooses timing, not model randomness.',
    steps: [], findings: [], finalState: null, status: 'running' };
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  async function step(action, perform) {
    const entry = { index: run.steps.length, action, status: 'running' }; run.steps.push(entry);
    try { await perform(); entry.state = await snapshot(page); entry.status = 'passed'; }
    catch (error) { entry.status = 'failed'; entry.error = error.message; throw error; }
  }
  async function contains(id, value) {
    await page.locator('#' + id).filter({ hasText: value }).waitFor({ timeout: 15000 });
  }
  try {
    await step('open first-play entry', async () => {
      await page.goto('/world/journeys/bakery.html' + (scenario.strategy === 'invalid-share' ? '?recipe=bakery-v999.2911.72' : ''));
      await contains('scene-status', 'Bakery closed');
    });
    if (scenario.strategy === 'invalid-share') {
      await step('inspect unsupported recipe recovery', () => contains('experiment-status', 'The shared future could not open.'));
    } else {
      await step('inspect closure evidence', async () => {
        await page.getByRole('link', { name: 'Riverside Bakery closes', exact: true }).click();
        await contains('why', '40 of the bakery’s 100-unit order');
      });
      await step(`intervene at month ${scenario.month}`, async () => {
        await page.getByRole('slider', { name: 'Simulation timeline' }).fill(String(scenario.month));
        await page.locator('#branch').click();
        await contains('experiment-status', scenario.strategy === 'too-late' ? 'The bakery still closes.' : 'Mystery solved.');
      });
      await step('reopen shared future', async () => {
        const share = await page.getByLabel('Share this future').inputValue();
        await page.goto(share);
        await contains('scene-status', scenario.strategy === 'too-late' ? 'With change Closed' : 'With change Open');
      });
    }
    if (errors.length) throw new Error('Uncaught browser errors: ' + errors.join('; '));
    run.status = 'passed';
  } catch (error) {
    run.status = 'failed';
    run.findings.push({ kind: 'broken-state', step: run.steps.at(-1)?.index, message: error.message });
  } finally {
    run.finalState = await snapshot(page).catch(() => null);
    page.off('pageerror', onError);
  }
  return run;
}
export function compareReplay(recorded, replay) {
  if (recorded.version !== LAB_VERSION || recorded.revision !== replay.revision) throw new Error('Replay requires matching lab version and source revision');
  return JSON.stringify([recorded.scenario, recorded.steps, recorded.finalState, recorded.status]) ===
    JSON.stringify([replay.scenario, replay.steps, replay.finalState, replay.status]);
}
export function triageDraft(run) {
  if (run.version !== LAB_VERSION || !run.findings?.length || run.status !== 'failed') throw new Error('A failed lab run is required');
  return { title: `[Player Lab] ${run.scenario.strategy}: ${run.findings[0].kind}`,
    description: 'Automated finding; human triage required. Do not dispatch automatically.\n\nHuman playtests SHE-29 and SHE-62 remain the final judge of fun.\n\nReplay evidence:\n```json\n' + JSON.stringify(run, null, 2) + '\n```' };
}
