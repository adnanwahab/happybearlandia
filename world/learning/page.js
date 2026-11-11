import { encodePlan, futureURL, normalizePlan } from '../invention/model.js';
import { mountAssembly } from './assembly.js';
import { createJournal } from './journal.js';
import { measureSensors, mountObservatory, normalizeSensors } from './observatory.js';
import { createPrediction, mountPrediction, resolvePrediction } from './prediction.js';

const find = id => document.getElementById(id);
const form = find('settings');
const reveal = find('reveal');
let storage;
try { storage = localStorage; } catch { /* An in-memory journal supports this visit. */ }
const journal = createJournal(storage);
let round;
let baseline;
let worker;

function storageStatus() {
  find('storage').hidden = !journal.volatile;
}

const observatory = mountObservatory(find('observatory'), {
  onChange(sensors) {
    if (round.approved) return;
    round.sensors = normalizeSensors(sensors, baseline);
    journal.setObservations(round.id, measureSensors(baseline, round.sensors));
    journal.setCurrent(round);
    render();
  },
});

const assembly = mountAssembly(find('assembly'), {
  onApprove(plan, decision) {
    const recipe = normalizePlan(plan);
    if (round.approved || recipe.seed !== baseline.recipe.seed || recipe.months !== baseline.recipe.months) return;
    round.approved = { plan: recipe, decision };
    journal.setCurrent(round);
    render();
  },
});

const predictions = mountPrediction(find('prediction'), {
  onCommit(input) {
    if (!round.approved || journal.prediction(round.id) || journal.outcome(round.id)) return;
    const prediction = createPrediction(round.approved.plan, input);
    journal.lockPrediction(round.id, prediction);
    render();
  },
});

function render() {
  const prediction = journal.prediction(round.id);
  const outcome = journal.outcome(round.id);
  observatory.render({ baseline, sensors: round.sensors, locked: Boolean(round.approved) });
  assembly.render({
    baseline, sensors: round.sensors, observations: journal.observations(round.id) ?? [],
    approved: round.approved?.decision ?? null,
  });
  predictions.render({
    plan: round.approved?.plan ?? null, prediction, resolution: outcome?.resolution ?? null, history: journal.history(),
  });
  find('reveal-panel').hidden = !round.approved;
  reveal.disabled = !prediction || Boolean(outcome) || Boolean(worker);
  find('replays').hidden = !outcome;
  if (outcome) {
    find('reveal-status').textContent = `Approved future resolved at month ${outcome.month}.`;
    find('adjusted-link').href = futureURL(round.approved.plan, outcome.month);
    find('baseline-link').href = futureURL(baseline.recipe, outcome.month);
  } else if (!worker) {
    find('reveal-status').textContent = prediction ? 'Prediction locked. Run the approved future to score it.' : 'Lock a prediction to continue.';
  }
  storageStatus();
}

function simulate(plan, retainMonths, onResult, onError) {
  worker?.terminate();
  worker = null;
  try {
    const job = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker = job;
    function finish() {
      if (worker !== job) return false;
      job.terminate();
      worker = null;
      return true;
    }
    job.onmessage = ({ data }) => {
      if (!finish()) return;
      if (data.error) onError(data.error);
      else onResult(data.result);
    };
    job.onerror = () => {
      if (finish()) onError('The City simulation worker could not run.');
    };
    job.postMessage({ plan, retainMonths });
  } catch {
    worker?.terminate();
    worker = null;
    onError('The City simulation worker could not start.');
  }
}

function start(settings, saved) {
  const recipe = normalizePlan({ ...settings, policies: [] });
  round = saved ?? { id: crypto.randomUUID(), seed: recipe.seed, months: recipe.months, sensors: [], approved: null };
  form.elements.seed.value = recipe.seed;
  form.elements.months.value = recipe.months;
  find('round').hidden = true;
  find('round-status').textContent = 'Opening the baseline…';
  simulate(recipe, true, result => {
    baseline = result;
    try {
      round.sensors = normalizeSensors(round.sensors, baseline);
      if (round.approved && encodePlan({ ...round.approved.plan, policies: [] }) !== encodePlan(baseline.recipe)) {
        throw new Error('The saved proposal uses a different baseline.');
      }
      if (!round.approved || !journal.observations(round.id)) {
        journal.setObservations(round.id, measureSensors(baseline, round.sensors));
      }
      journal.setCurrent(round);
      find('round-status').textContent =
        `Baseline ready · Seed ${recipe.seed} · Months ${result.start.month}–${result.final.month} · ${recipe.modelVersion}`;
      render();
      find('round').hidden = false;
    } catch (error) {
      find('round-status').textContent = error.message;
    }
  }, error => { find('round-status').textContent = error; });
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const { seed, months } = form.elements;
  try {
    start({ seed: seed.valueAsNumber, months: months.valueAsNumber });
  } catch (error) {
    find('round-status').textContent = error.message;
  }
});

reveal.addEventListener('click', () => {
  const { id, approved } = round;
  const prediction = journal.prediction(id);
  if (!approved || !prediction || journal.outcome(id) || worker) return;
  reveal.disabled = true;
  find('reveal-status').textContent = 'Running the approved City policy…';
  function showError(error) {
    render();
    find('reveal-status').textContent = error;
  }
  simulate(approved.plan, false, adjusted => {
    try {
      const resolution = resolvePrediction(prediction, baseline, adjusted);
      journal.saveOutcome(id, { month: adjusted.final.month, resolution });
      render();
    } catch (error) {
      showError(error.message);
    }
  }, showError);
});

try {
  const saved = journal.current();
  start(saved ? { seed: saved.seed, months: saved.months } : {}, saved);
} catch {
  start({});
}
