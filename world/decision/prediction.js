// Player interpretation only. Never included in a model input or stored run.
export const predictionKey = input => JSON.stringify([input.modelId, input.modelVersion, input.seed, input.runs, input.years, input.scenarios]);
export function scoreDirection(expected, baseline, alternative) {
  if (!['up', 'down', 'tie'].includes(expected) || !Number.isFinite(baseline) || !Number.isFinite(alternative)) return { actual: 'unknown', matched: null, delta: null };
  const delta = alternative - baseline;
  const actual = delta === 0 ? 'tie' : delta > 0 ? 'up' : 'down';
  return { actual, matched: expected === actual, delta };
}
export function resolvePrediction(prediction, data) {
  const experiment = data?.experiment;
  if (!prediction || experiment?.status !== 'completed' || prediction.key !== predictionKey(experiment)) return null;
  const baseline = experiment.scenarios.find(s => s.kind === 'baseline');
  const rows = data.runs || [];
  const controls = new Map(rows.filter(r => r.scenarioId === baseline?.id && r.status === 'completed').map(r => [r.seed, r]));
  const pairs = rows.filter(r => r.scenarioId === prediction.scenarioId && r.status === 'completed').map(r => [controls.get(r.seed), r]);
  // Incomplete batches and missing observations cannot be scored as zero.
  const valid = pairs.length === experiment.runs && pairs.every(([a,b]) => Number.isFinite(a?.metrics?.housing_supply) && Number.isFinite(b.metrics?.housing_supply));
  const mean = index => pairs.reduce((sum,pair) => sum + pair[index].metrics.housing_supply / pairs.length, 0);
  return { experimentId: experiment.id, ...scoreDirection(prediction.direction, valid ? mean(0) : null, valid ? mean(1) : null) };
}
export function mountPrediction(container, { getInput, unavailable = () => false }) {
  container.innerHTML = `<h3>Predict then reveal</h3><p class="fine">Before simulating: will mean final housing supply rise, fall or tie versus current policy? Unit: homes. Synthetic housing model; this is your guess, not a forecast or leaderboard.</p><label>Policy alternative<select data-prediction-scenario aria-label="Prediction policy alternative"></select></label><label>Your prediction<select data-prediction-direction aria-label="Predicted housing supply direction"><option value="">Choose a direction…</option><option value="up">Rise · homes</option><option value="down">Fall · homes</option><option value="tie">Tie · homes</option><option value="unknown">I don’t know</option></select></label><button data-prediction-lock class="full quiet">Lock prediction</button><p data-prediction-status role="status" aria-live="polite">No prediction yet. Optional: choose before your next run.</p>`;
  const select = container.querySelector('[data-prediction-scenario]'), direction = container.querySelector('[data-prediction-direction]'), button = container.querySelector('button'), status = container.querySelector('[role=status]');
  let prediction = null, outcome = null, experimentId = null;
  function update() {
    const input = getInput();
    const choices = input.scenarios.filter(s => s.kind !== 'baseline');
    const previous = select.value;
    select.replaceChildren(...choices.map(s => { const option = container.ownerDocument.createElement('option'); option.value = s.id; option.textContent = s.name; return option; }));
    if (choices.some(s => s.id === previous)) select.value = previous;
    button.disabled = select.disabled = direction.disabled = Boolean(prediction) || unavailable() || !choices.length;
    if (!prediction && !choices.length) status.textContent = 'Prediction unavailable: add a policy alternative.';
    else if (prediction && !outcome && prediction.key !== predictionKey(input)) status.textContent = 'Prediction locked for earlier inputs. Restore those inputs to reveal; reruns never change your guess.';
  }
  button.addEventListener('click', () => {
    if (prediction || unavailable()) return;
    if (!direction.value || !select.value) { status.textContent = 'Choose an alternative and direction first.'; return; }
    prediction = Object.freeze({ key: predictionKey(getInput()), scenarioId: select.value, direction: direction.value, metric: 'housing_supply', unit: 'homes' });
    status.textContent = 'Prediction locked. Simulate this plan to reveal the modeled comparison. Kept for this page session.';
    update();
  });
  update();
  return { update, bind(experiment, { preview = false } = {}) {
    if (!preview && !experimentId && prediction?.key === predictionKey(experiment)) experimentId = experiment.id;
  }, reveal(data) {
    if (outcome || !experimentId || data?.experiment?.id !== experimentId) return;
    outcome = resolvePrediction(prediction, data);
    if (!outcome) return;
    status.textContent = `Prediction: ${prediction.direction}. Modeled result: ${outcome.actual}${outcome.delta === null ? ' · comparison unavailable; unscored' : ` · ${outcome.delta.toFixed(2)} homes · ${outcome.matched ? 'matched' : 'did not match'}`}. Experiment ${outcome.experimentId}. Synthetic result; no real-world predictive validity.`;
  }, get prediction() { return prediction; }, get outcome() { return outcome; } };
}
