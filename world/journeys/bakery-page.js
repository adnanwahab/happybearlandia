import { decodeBakeryRecipe, encodeBakeryRecipe } from './bakery-scenario.js';

const find = id => document.getElementById(id);
const monthInput = find('month');
const branchButton = find('branch');
const experimentStatus = find('experiment-status');
const sceneTemplate = find('scene-template');
const baselineScene = find('baseline-scene');
const futureScene = find('future-scene');
const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const calendar = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const scoreKey = 'hbl:riverside-bakery:best';
const pending = new Map();
let worker;
let workerError;
let sequence = 0;
let baseline;
let future;
let busy = false;

function runInWorker(reopenMonth) {
  if (workerError) return Promise.reject(workerError);
  if (!worker) {
    worker = new Worker(new URL('./bakery-worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', ({ data }) => {
      const request = pending.get(data.id);
      if (!request) return;
      pending.delete(data.id);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.result);
    });
    worker.addEventListener('error', () => {
      workerError = new Error('The simulation worker could not load.');
      for (const request of pending.values()) request.reject(workerError);
      pending.clear();
      worker.terminate();
    });
  }
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, reopenMonth });
  });
}

function monthDate(row) {
  return calendar.format(new Date(Date.UTC(row.year, row.month % 12, 1)));
}

function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

function makeURL(month, recipe = future?.recipe) {
  const url = new URL(location.href);
  url.hash = '';
  url.searchParams.delete('recipe');
  url.searchParams.set('month', month);
  if (recipe) url.searchParams.set('recipe', encodeBakeryRecipe(recipe));
  return url;
}

function drawScene(node, row) {
  node.dataset.open = String(row.bakeryOpen);
  node.querySelector('.road-barrier').hidden = !row.roadClosed;
  node.querySelector('.bakery').textContent = row.bakeryOpen ? 'Bakery · Open' : 'Bakery · Closed';
}

function drawMetrics(original, alternate) {
  const metrics = [
    ['Flour delivered', row => `${format.format(row.delivered)} units`],
    ['Unfilled demand', row => `${format.format(row.unserved)} units`],
    ['Transport cost', row => `${format.format(row.transportCost)} currency`],
    ['Luis’s shift', row => `${format.format(row.workerHours)} hours`],
  ];
  find('metrics').replaceChildren(...metrics.map(([label, value]) => {
    const item = document.createElement('dl');
    item.className = 'metric';
    const left = value(original);
    const right = alternate ? value(alternate) : left;
    item.append(element('dt', label), element('dd', left === right ? left : `${left} → ${right}`));
    return item;
  }));
}

function drawEvidence(record, row) {
  const items = [
    row.roadClosed ? 'The direct route was closed. Flour could only reach the bakery by detour.'
      : 'The direct route was available.',
    row.bakeryOpen || row.delivered > 0
      ? `The delivery model filled ${format.format(row.delivered)} of the bakery’s 100-unit order.`
      : 'The bakery had already closed and placed no flour order.',
  ];
  const closure = record.events.find(event => event.title === 'Riverside Bakery closes' && event.month <= row.month);
  if (closure) items.push('Three consecutive short deliveries triggered the bakery’s closure rule.');
  items.push(`The scenario scheduled Luis for ${format.format(row.workerHours)} of the usual 8 hours.`);
  const chain = document.createElement('ol');
  chain.append(...items.map(item => element('li', item)));
  const evidence = find('why');
  evidence.replaceChildren(chain);
  if (closure) {
    const jump = element('a', `Read the closure record · ${monthDate(record.months[closure.month])}`);
    const line = document.createElement('p');
    bindJump(jump, closure.month);
    line.append(jump);
    evidence.append(line);
  }
}

function syncLever(month) {
  const selected = baseline.months[month];
  branchButton.disabled = busy || month < baseline.decisionMonth;
  find('reset').disabled = busy;
  const verb = month === baseline.decisionMonth ? 'Keep the route open' : 'Reopen the route';
  branchButton.textContent = busy ? 'Simulating…' : `${verb} · ${monthDate(selected)}`;
  find('lever-help').textContent = month < baseline.decisionMonth
    ? `The closure is recorded in ${monthDate(baseline.months[baseline.decisionMonth])}. Jump there to change the decision.`
    : 'Test one road intervention against the baseline with the same seed.';
}

function showMonth(month, { updateURL = true } = {}) {
  const original = baseline.months[month];
  if (!original) return;
  const alternate = future?.months[month];
  monthInput.value = month;
  find('date').value = monthDate(original);
  monthInput.setAttribute('aria-valuetext', monthDate(original));
  drawScene(baselineScene, original);
  if (alternate) drawScene(futureScene, alternate);
  const state = row => row.bakeryOpen ? 'Open' : 'Closed';
  find('scene-status').textContent = alternate
    ? `Baseline ${state(original)} · With change ${state(alternate)}`
    : `Bakery ${state(original).toLowerCase()} · Schematic map`;
  drawMetrics(original, alternate);
  drawEvidence(future ?? baseline, alternate ?? original);
  for (const marker of find('clues').children) {
    marker.setAttribute('aria-current', String(Number(marker.dataset.month) === month));
  }
  syncLever(month);
  if (updateURL) history.replaceState(history.state, '', makeURL(month));
}

function bindJump(link, month) {
  link.href = makeURL(month).href;
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    showMonth(month);
    monthInput.focus();
  });
}

function drawHeadlines() {
  const record = future ?? baseline;
  find('edition').textContent = future
    ? `What-if edition · seed ${record.seed}`
    : `Baseline edition · seed ${record.seed}`;
  const paper = find('headlines');
  const articles = record.events.map(event => {
    const article = document.createElement('article');
    const time = element('time', monthDate(record.months[event.month]));
    const title = document.createElement('h3');
    const link = element('a', event.title);
    bindJump(link, event.month);
    title.append(link);
    article.append(time, title, element('p', event.detail));
    return article;
  });
  paper.replaceChildren(...articles);
}

function drawClues() {
  // Keep baseline clues visible during a comparison so the mystery remains explorable.
  const clues = baseline.events.map(event => {
    const button = element('button', event.title);
    button.type = 'button';
    button.dataset.month = event.month;
    button.addEventListener('click', () => showMonth(event.month));
    return button;
  });
  find('clues').replaceChildren(...clues);
}

function bestSuccessfulMonth(month) {
  try {
    const key = `${scoreKey}:${baseline.version}:${baseline.seed}`;
    const stored = localStorage.getItem(key);
    const previous = Number(stored);
    const isValid = stored !== null && Number.isInteger(previous) &&
      previous >= baseline.decisionMonth && previous <= baseline.finalMonth;
    const best = isValid ? Math.min(previous, month) : month;
    localStorage.setItem(key, String(best));
    return best;
  } catch {
    return null;
  }
}

function showFuture(next, selectedMonth, { score = true } = {}) {
  future = next;
  futureScene.hidden = !future;
  find('swipe').hidden = !future;
  find('divider').hidden = !future;
  find('share').hidden = !future;
  if (future) {
    const final = future.months[future.finalMonth];
    const success = future.months.every(row => row.bakeryOpen);
    const result = success
      ? `Mystery solved. The bakery stays open through ${monthDate(final)}. Luis works ${format.format(final.workerHours)} hours in the final month.`
      : `The bakery still closes. Luis works ${format.format(final.workerHours)} hours in the final month.`;
    const best = success && score ? bestSuccessfulMonth(future.recipe.reopenMonth) : null;
    const attempt = monthDate(future.months[future.recipe.reopenMonth]);
    experimentStatus.textContent = `Change tested in ${attempt}. ${result}` +
      (best === null ? '' : ` Earliest successful change on this device is ${monthDate(future.months[best])}.`);
    find('recipe-link').value = makeURL(future.finalMonth).href;
  } else {
    experimentStatus.textContent = '';
  }
  drawHeadlines();
  showMonth(selectedMonth);
}

async function tryChange() {
  const chosen = Number(monthInput.value);
  busy = true;
  syncLever(chosen);
  try {
    const result = await runInWorker(chosen);
    showFuture(result, Number(monthInput.value));
  } catch (error) {
    experimentStatus.textContent = `The change could not run. ${error.message}`;
  } finally {
    busy = false;
    syncLever(Number(monthInput.value));
  }
}

async function openJourney() {
  const initialStatus = find('initial-status');
  const params = new URLSearchParams(location.search);
  const recipe = params.get('recipe');
  try {
    baseline = await runInWorker(null);
    baselineScene.append(sceneTemplate.content.cloneNode(true));
    futureScene.append(sceneTemplate.content.cloneNode(true));
    monthInput.max = baseline.finalMonth;
    find('start-year').textContent = baseline.months[0].year;
    find('end-year').textContent = baseline.months[baseline.finalMonth].year;
    drawClues();
    let month = baseline.finalMonth;
    if (params.has('month') && /^[0-9]+$/.test(params.get('month'))) {
      const requested = Number(params.get('month'));
      if (baseline.months[requested]) month = requested;
    }
    let alternate = null;
    let recipeError = '';
    if (recipe !== null) {
      try {
        const decoded = decodeBakeryRecipe(recipe);
        if (decoded.reopenMonth !== null) alternate = await runInWorker(decoded.reopenMonth);
      } catch (error) {
        recipeError = `The shared future could not open. ${error.message}`;
      }
    }
    showFuture(alternate, month, { score: false });
    if (recipeError) experimentStatus.textContent = recipeError;
    find('journey').hidden = false;
    initialStatus.hidden = true;
  } catch (error) {
    initialStatus.textContent = `The timeline could not open. ${error.message}`;
  }
}

monthInput.addEventListener('input', () => showMonth(Number(monthInput.value)));
branchButton.addEventListener('click', tryChange);
find('reset').addEventListener('click', () => showFuture(null, Number(monthInput.value)));
find('reveal').addEventListener('input', event => {
  find('comparison').style.setProperty('--split', `${event.target.value}%`);
});
find('copy').addEventListener('click', async () => {
  const link = find('recipe-link');
  const copy = find('copy');
  try {
    await navigator.clipboard.writeText(link.value);
    copy.textContent = 'Copied';
    setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
  } catch {
    link.select();
  }
});
openJourney();
