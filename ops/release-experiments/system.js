import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';

const required = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw Error(`Missing ${name}`);
};
function path(value) {
  required(value, 'path');
  if (!/^\/[a-zA-Z0-9/_-]+(?:\.html)?$/.test(value) || value.startsWith('//') || value.startsWith('/api/')) throw Error('Expected a local application path');
}
export function createExperiment(spec) {
  for (const key of ['id', 'seed', 'candidateRevision', 'controlRevision', 'goNoGoEvidence', 'selectionRationale', 'metric', 'windowStart', 'windowEnd']) required(spec[key], key);
  for (const key of ['entryPath', 'candidatePath', 'controlPath']) path(spec[key]);
  if (new Set([spec.entryPath, spec.candidatePath, spec.controlPath]).size !== 3) throw Error('Paths must differ');
  if (!Number.isFinite(Date.parse(spec.windowStart)) || !Number.isFinite(Date.parse(spec.windowEnd)) || Date.parse(spec.windowEnd) <= Date.parse(spec.windowStart)) throw Error('Invalid observation window');
  if (typeof spec.consentRequired !== 'boolean') throw Error('Declare consentRequired');
  if (!Number.isInteger(spec.populationSize) || !Number.isInteger(spec.maxTreatment) || spec.maxTreatment < 1 || spec.maxTreatment > spec.populationSize * 0.1) throw Error('Treatment cap must be at most 10% of population');
  if (!Number.isInteger(spec.minPerArm) || spec.minPerArm < 1 || !Number.isFinite(spec.regressionThreshold) || spec.regressionThreshold < 0 || spec.regressionThreshold > 1) throw Error('Invalid metric threshold/sample floor');
  if (!Array.isArray(spec.participants) || spec.participants.length < 2 || spec.participants.length >= spec.populationSize) throw Error('Select a bounded roster');
  const seen = new Set();
  const eligible = spec.participants.filter(p => {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(p.id) || seen.has(p.id)) throw Error('Invalid or duplicate participant');
    seen.add(p.id);
    if (p.consentEvidence !== undefined) required(p.consentEvidence, 'consentEvidence');
    return !spec.consentRequired || !!p.consentEvidence;
  });
  const rank = id => createHash('sha256').update(JSON.stringify([spec.id, spec.seed, id])).digest('hex');
  eligible.sort((a, b) => rank(a.id).localeCompare(rank(b.id)));
  const count = Math.min(spec.maxTreatment, Math.floor(eligible.length / 2));
  if (count < spec.minPerArm || eligible.length - count < spec.minPerArm) throw Error('Not enough eligible participants');
  const assignments = Object.fromEntries(eligible.map((p, i) => [p.id, i < count ? 'treatment' : 'control']));
  return { version: 1, spec: structuredClone(spec), assignments, observations: [], decisions: [], status: 'running', proposal: null };
}
export function results(state) {
  const arms = { treatment: { n: 0, successes: 0 }, control: { n: 0, successes: 0 } };
  for (const item of state.observations) {
    const arm = arms[state.assignments[item.participantId]];
    arm.n++; arm.successes += Number(item.success);
  }
  for (const [name, arm] of Object.entries(arms)) {
    arm.rate = arm.n ? arm.successes / arm.n : null;
    arm.missing = Object.values(state.assignments).filter(value => value === name).length - arm.n;
  }
  const sufficient = Object.values(arms).every(a => a.n >= state.spec.minPerArm);
  const regression = sufficient ? arms.control.rate - arms.treatment.rate : null;
  return { metric: state.spec.metric, arms, sufficient, regression, threshold: state.spec.regressionThreshold,
    breached: sufficient && regression > state.spec.regressionThreshold,
    limitation: 'Descriptive selected-cohort success rates; no statistical significance or causal claim.' };
}
export function applyEvent(state, event) {
  if (!state) {
    if (event.type !== 'create') throw Error('Create first');
    return createExperiment(event.spec);
  }
  state = structuredClone(state);
  if (event.type === 'observe') {
    const o = event.observation;
    if (state.status !== 'running') throw Error('Experiment is closed');
    if (!Object.hasOwn(state.assignments, o.participantId) || typeof o.success !== 'boolean') throw Error('Observation needs an assigned participant and boolean success');
    required(o.evidence, 'observation evidence');
    const time = Date.parse(o.observedAt);
    if (!Number.isFinite(time) || time < Date.parse(state.spec.windowStart) || time > Date.parse(state.spec.windowEnd)) throw Error('Observation outside written window');
    if (state.observations.some(x => x.participantId === o.participantId)) throw Error('One outcome per participant');
    state.observations.push(structuredClone(o));
    if (results(state).breached && !state.proposal) state.proposal = { id: `${state.spec.id}:rollback`, evidence: results(state), observedAt: o.observedAt, status: 'pending', checklist: 'docs/release-operations.md#incident-checklist-and-severity' };
  } else if (event.type === 'decide') {
    const d = event.decision;
    for (const key of ['human', 'approvalEvidence', 'reason', 'decidedAt']) required(d[key], key);
    if (!Number.isFinite(Date.parse(d.decidedAt))) throw Error('Invalid decision date');
    if (state.status !== 'running') throw Error('Experiment is closed');
    if (d.action === 'rollback') {
      if (!state.proposal || d.proposalId !== state.proposal.id) throw Error('Approve the exact rollback proposal');
      state.proposal.status = 'approved'; state.status = 'rolled-back';
    } else if (d.action === 'promote') {
      if (state.proposal || !results(state).sufficient || results(state).breached) throw Error('Promotion blocked by regression or missing evidence');
      required(d.goNoGoEvidence, 'current go/no-go evidence');
      if (Date.parse(d.decidedAt) < Date.parse(state.spec.windowEnd)) throw Error('Wait for observation window to close');
      state.status = 'promoted';
    } else throw Error('Unknown decision');
    state.decisions.push(structuredClone(d));
  } else throw Error('Unknown event');
  return state;
}
export function replay(events) {
  if (!Array.isArray(events) || !events.length) throw Error('Expected event history');
  return events.reduce(applyEvent, null);
}
export function readExperiment(file) { return replay(JSON.parse(readFileSync(file, 'utf8'))); }

// Identity comes from a trusted host resolver, never from an arbitrary request header.
// This navigation gate does not authorize access to the target page itself.
export function createExperimentHandler({ file, identify = () => null, now = () => Date.now() }) {
  return request => {
    if (!file) return null;
    let state;
    try { state = readExperiment(file); } catch { return new Response('Release routing unavailable', { status: 503, headers: { 'cache-control': 'no-store' } }); }
    if (new URL(request.url).pathname !== state.spec.entryPath) return null;
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    const id = identify(request, state.spec.id);
    const inWindow = now() >= Date.parse(state.spec.windowStart) && now() <= Date.parse(state.spec.windowEnd);
    const consentEligible = !state.spec.consentRequired || Object.hasOwn(state.assignments, id);
    const treatment = (state.status === 'promoted' && consentEligible) || (state.status === 'running' && inWindow && state.assignments[id] === 'treatment');
    return new Response(null, { status: 302, headers: { location: treatment ? state.spec.candidatePath : state.spec.controlPath, 'cache-control': 'private, no-store', vary: 'Cookie' } });
  };
}

// Provision cookies privately after consent/selection; signing secret stays on host.
export function participantCookie(experimentId, participantId, secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw Error('Identity secret needs at least 32 characters');
  const payload = Buffer.from(JSON.stringify([experimentId, participantId])).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function cookieIdentity(request, experimentId, secret) {
  if (!secret || secret.length < 32) return null;
  const token = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith('hbl_release='))?.slice(12);
  if (!token || token.length > 1000) return null;
  try {
    const [payload, signature] = token.split('.');
    const [experiment, id] = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const expected = participantCookie(experiment, id, secret).split('.')[1];
    if (experiment !== experimentId || !signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    return id;
  } catch { return null; }
}
