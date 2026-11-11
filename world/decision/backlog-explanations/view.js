import { createDecisionClient } from '../client.js';
import { clusterFailures } from './clusters.js';
import { recordedRipple, answerEvidence } from './evidence.js';
import { housingCausalRegistry } from '../../models/housing/causal-registry.js';
import { housingModel } from '../../models/housing/index.js';

/** Companion to mountIntelligence. Host supplies the same immutable results and selection. */
export function mountBacklogExplanations(container, { onSelectRun, onEvent, loadRunTrace } = {}) {
  const doc = container.ownerDocument;
  const root = doc.createElement('section'); root.className = 'backlog-explanations';
  root.style.cssText = 'display:grid;gap:12px;max-width:100%;overflow-wrap:anywhere';
  const make = (tag, text) => { const el = doc.createElement(tag); if (text !== undefined) el.textContent = text; if (tag === 'pre') el.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;min-width:0'; return el; };
  root.append(make('h3', 'Failure clusters and recorded explanations'));
  const summary = make('p'), clusters = make('div'), query = make('form'), label = make('label', 'Ask why or compare a named metric '), input = make('input'), submit = make('button', 'Inspect evidence'), answer = make('div'), ripple = make('div');
  query.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:end'; input.maxLength = 1000; input.placeholder = 'Why did median rent change?'; input.style.maxWidth = '100%'; label.append(input); submit.type = 'submit'; query.append(label, submit);
  answer.setAttribute('aria-live', 'polite'); root.append(summary, clusters, query, answer, ripple); container.append(root);
  let context = {}, data, run, reference, frames = [], index = 0, timer, generation = 0;
  const client = createDecisionClient();
  const load = loadRunTrace || (async row => (await client.run(row.experimentId, row.id)).run);
  const stop = () => { clearInterval(timer); timer = null; };
  const showFrame = () => {
    const frame = frames[index]; ripple.replaceChildren();
    ripple.append(make('h4', 'Recorded ripple playback'));
    if (!frame) { ripple.append(make('p', data?.reason || 'No dated recorded events.')); return; }
    const rangeLabel = make('label', 'Recorded event '), range = make('input'); range.type = 'range'; range.min = '0'; range.max = String(frames.length - 1); range.value = String(index); rangeLabel.append(range);
    range.oninput = () => { stop(); index = Number(range.value); showFrame(); };
    const play = make('button', timer ? 'Pause' : 'Play recorded events'); play.type = 'button';
    play.onclick = () => { if (timer) { stop(); showFrame(); return; } if (index === frames.length - 1) index = 0; timer = setInterval(() => { if (index < frames.length - 1) index++; else stop(); showFrame(); }, 1200); showFrame(); };
    ripple.append(rangeLabel, play, make('p', `Month ${frame.month} · ${frame.event.type} · ${frame.event.label || frame.event.message || ''}`));
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', `0 0 360 ${Math.max(36, frame.edges.length * 58)}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Registered rule associations for this recorded event'); svg.style.cssText = 'display:block;width:100%;max-width:700px';
    frame.edges.forEach((edge, i) => {
      const text = doc.createElementNS(svg.namespaceURI, 'text'); text.setAttribute('x', '4'); text.setAttribute('y', String(16 + i * 58)); text.setAttribute('fill', 'currentColor'); text.setAttribute('font-size', '12'); text.textContent = `${edge.from} → ${edge.to}`;
      const line = doc.createElementNS(svg.namespaceURI, 'path'); line.setAttribute('d', `M4 ${24 + i * 58} H345 l-6 -4 m6 4 l-6 4`); line.setAttribute('stroke', 'currentColor'); line.setAttribute('fill', 'none');
      const caption = doc.createElementNS(svg.namespaceURI, 'text'); caption.setAttribute('x', '4'); caption.setAttribute('y', String(46 + i * 58)); caption.setAttribute('fill', 'currentColor'); caption.setAttribute('font-size', '10'); caption.textContent = edge.equationId; svg.append(text, line, caption);
    }); ripple.append(svg);
    const list = make('ul'); for (const edge of frame.edges) list.append(make('li', `${edge.from} → ${edge.to} · rule ${edge.equationId} · registered association`)); ripple.append(list);
    if (!frame.edges.length) ripple.append(make('p', 'No registered rule association for this event.'));
    const inspect = make('button', 'Inspect source event'); inspect.type = 'button'; inspect.dataset.month = String(frame.month); inspect.onclick = () => onEvent?.({ run, ...frame.reference, month: frame.month }); ripple.append(inspect, make('small', data.limitation));
  };
  query.onsubmit = async event => {
    event.preventDefault();
    const token = ++generation; submit.disabled = true;
    try {
    let compared = reference;
    if (/what.*chang|compar|differ|between/i.test(input.value) && compared?.experimentId && !(compared.monthlyTimeline?.length || compared.timeline?.length)) {
      const loaded = await load(compared);
      if (token !== generation) return;
      if (!loaded || loaded.id !== compared.id || loaded.experimentId !== compared.experimentId || loaded.seed !== compared.seed || loaded.modelVersion !== compared.modelVersion) throw new Error('Reference trace identity mismatch.');
      compared = loaded;
    }
    const result = answerEvidence({ query: input.value, run, referenceRun: compared, registry: context.registry || housingCausalRegistry, model: context.model || context.results?.model || housingModel, month: context.month ?? Infinity });
    answer.replaceChildren(make('p', result.text));
    if (result.equations) for (const equation of result.equations) answer.append(make('pre', `${equation.label}: ${equation.expression}\n${equation.source}`));
    if (result.events) answer.append(make('p', `Event references: ${result.events.map(e => `${e.reference.runId}[${e.reference.eventIndex}] @ month ${e.month}`).join(', ') || 'unavailable'}`));
    } catch (error) { if (token === generation) answer.replaceChildren(make('p', `Evidence unavailable: ${error.message}`)); } finally { if (token === generation) submit.disabled = !run; }
  };
  return {
    update(next = {}) {
      stop(); generation++; context = next; answer.replaceChildren(); index = 0;
      const results = next.results || {}, experiment = results.experiment || next.input, runs = results.runs || [], model = next.model || results.model || housingModel;
      run = next.selectedRun || runs.find(r => r.id === next.selectedRunId);
      const scenarioId = experiment?.scenarios?.find(s => s.kind === 'baseline')?.id;
      reference = next.referenceRun || runs.find(r => r.scenarioId === scenarioId && r.seed === run?.seed && r.modelVersion === run?.modelVersion);
      clusters.replaceChildren();
      const features = next.clusterFeatures || ['construction_capacity', 'permitting_months', 'interest_rate'].filter(id => model.parameters.some(p => p.id === id));
      try {
        const output = clusterFailures({ experiment, runs, model, features }); summary.textContent = `${output.failureCount} evaluated failures / ${output.inputCount} records. ${output.method}`;
        for (const group of output.groups) {
          clusters.append(make('h4', `${group.scenarioId} · ${group.modelVersion}`), make('p', `${group.excludedRunIds.length} failures excluded for missing selected inputs. Iterations ${group.iterations}/${group.iterationLimit}; ${group.converged ? 'assignment converged' : 'iteration limit reached; grouping provisional'}. Scaling: ${JSON.stringify(group.normalization)}`));
          for (const cluster of group.clusters) {
            const details = make('details'), heading = make('summary', `${cluster.id}: ${cluster.runIds.length} failures`); details.append(heading, make('p', `Effective-input centroid: ${JSON.stringify(cluster.centroid)}`));
            for (const id of cluster.runIds) { const button = make('button', `Inspect ${id}`); button.type = 'button'; button.onclick = () => onSelectRun?.(runs.find(r => r.id === id)); details.append(button); } clusters.append(details);
          }
        }
      } catch (error) { summary.textContent = error.message; }
      data = recordedRipple({ run, registry: next.registry || housingCausalRegistry, month: next.month ?? Infinity, nodeId: next.nodeId }); frames = data.frames; showFrame(); submit.disabled = !run;
    },
    destroy() { generation++; stop(); root.remove(); },
  };
}
