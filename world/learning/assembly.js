import { normalizePlan, planCost, PLAN_START_MONTH, POLICY_CATALOG } from '../invention/model.js';

export const ASSEMBLY_VERSION = 'riverside-citizen-assembly.v1';
export const ASSEMBLY_BUDGET = 500000;
const REQUIRED_SUPPORT = 3;
const voteLabels = { support: 'Support', oppose: 'Oppose', abstain: 'Abstain' };
const ballots = Object.keys(voteLabels);
const seats = {
  mobility: {
    id: 'mobility', name: 'Mobility delegate',
    priority: 'Support transit investment when district commute readings reach 25 minutes.',
  },
  housing: {
    id: 'housing', name: 'Housing delegate',
    priority: 'Support housing or zoning proposals when the district records an unhoused household or mean rent reaches 1,300 modeled USD/month.',
  },
  treasury: {
    id: 'treasury', name: 'Budget delegate',
    priority: 'Support proposals within the assembly’s fixed capital budget.',
  },
  visitor: { id: 'visitor', name: 'Your seat', priority: 'Cast your own vote.' },
};
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const metrics = {
  meanCommuteMinutes: ['Mean recorded commute', 'minutes'],
  meanRent: ['Mean unit rent', 'modeled USD/month'],
  unhoused: ['Unhoused households', 'households'],
};

function observation(records, districtId, metric, latestMonth, recipe) {
  const usable = records.filter(row => row?.districtId === districtId && row.metric === metric &&
    Number.isSafeInteger(row.month) && row.month >= 0 && row.month <= latestMonth &&
    Number.isFinite(row.value) && row.value >= 0 &&
    (row.unit === undefined || row.unit === metrics[metric][1]) &&
    (row.status === undefined || row.status === 'measured') &&
    (row.provenance === undefined ||
      (row.provenance.seed === recipe.seed && row.provenance.modelVersion === recipe.modelVersion)));
  if (!usable.length) return null;
  const month = Math.max(...usable.map(row => row.month));
  const latest = usable.filter(row => row.month === month);
  if (latest.some(row => row.value !== latest[0].value)) return null;
  latest.sort((a, b) => String(a.id ?? a.sensorId ?? '').localeCompare(String(b.id ?? b.sensorId ?? '')));
  const row = latest[0];
  return {
    id: row.id ?? null, sensorId: row.sensorId ?? null, districtId, metric, month,
    value: row.value, unit: row.unit ?? null, uncertainty: structuredClone(row.uncertainty ?? null),
    ...(row.provenance && { provenance: structuredClone(row.provenance) }),
  };
}

function position(seat, vote, reason, evidence = []) {
  return { ...seat, vote, reason, evidence };
}

function mobilityVote(proposal, observations, latestMonth, recipe) {
  const seat = seats.mobility;
  if (proposal.type !== 'transit') {
    return position(seat, 'abstain', 'This proposal is outside the mobility rule.');
  }
  const commute = observation(observations, proposal.districtId, 'meanCommuteMinutes', latestMonth, recipe);
  if (!commute) {
    return position(seat, 'abstain', 'A valid district commute reading is unavailable.');
  }
  return commute.value >= 25
    ? position(seat, 'support', 'The observed mean commute meets the 25-minute threshold.', [commute])
    : position(seat, 'oppose', 'The observed mean commute is below the 25-minute threshold.', [commute]);
}

function housingVote(proposal, observations, latestMonth, recipe) {
  const seat = seats.housing;
  if (proposal.type !== 'housing' && proposal.type !== 'upzone') {
    return position(seat, 'abstain', 'This proposal is outside the housing rule.');
  }
  const rent = observation(observations, proposal.districtId, 'meanRent', latestMonth, recipe);
  const unhoused = observation(observations, proposal.districtId, 'unhoused', latestMonth, recipe);
  const evidence = [rent, unhoused].filter(Boolean);
  if (rent?.value >= 1300 || unhoused?.value >= 1) {
    return position(seat, 'support', 'At least one housing pressure threshold is met.', evidence);
  }
  if (evidence.length < 2) {
    return position(seat, 'abstain', 'A remaining housing pressure reading is unavailable.', evidence);
  }
  return position(seat, 'oppose', 'Both observed housing pressure measures are below the thresholds.', evidence);
}

export function deliberate({ baseline, observations = [], policyId, visitorVote }) {
  if (!ballots.includes(visitorVote)) throw new Error('Choose a visitor vote.');
  if (!baseline?.recipe) throw new Error('Open the baseline City plan first.');
  const recipe = normalizePlan(baseline.recipe);
  if (recipe.policies.length) throw new Error('The assembly requires a baseline without new policies.');
  const policy = POLICY_CATALOG.find(row => row.id === policyId);
  if (!policy) throw new Error('Choose a policy from the City catalog.');

  const plan = normalizePlan({ ...recipe, policies: [policy.id] });
  const cost = planCost(plan);
  const affordable = cost <= ASSEMBLY_BUDGET;
  const latestMonth = baseline.start?.month ?? PLAN_START_MONTH;
  const votes = [
    mobilityVote(policy, observations, latestMonth, recipe),
    housingVote(policy, observations, latestMonth, recipe),
    position(seats.treasury, affordable ? 'support' : 'oppose',
      affordable ? 'The proposed capital cost fits within the assembly budget.'
        : 'The proposed capital cost exceeds the assembly budget.'),
    position(seats.visitor, visitorVote, 'Visitor ballot.'),
  ];
  const tally = Object.fromEntries(ballots.map(vote => [vote, votes.filter(row => row.vote === vote).length]));
  return {
    plan,
    decision: {
      version: ASSEMBLY_VERSION, policyId, planVersion: plan.version, modelVersion: plan.modelVersion,
      seed: plan.seed, months: plan.months, observationCutoff: latestMonth,
      budget: ASSEMBLY_BUDGET, cost, remainingBudget: ASSEMBLY_BUDGET - cost, affordable,
      requiredSupport: REQUIRED_SUPPORT, votes, tally, approved: affordable && tally.support >= REQUIRED_SUPPORT,
    },
  };
}

function element(parent, tag, text) {
  const node = parent.ownerDocument.createElement(tag);
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}

function addOption(select, label, value) {
  element(select, 'option', label).value = value;
}

function evidenceLabel(record) {
  const [name, unit] = metrics[record.metric];
  const { uncertainty } = record;
  const range = uncertainty?.kind === 'rounding-bound'
    ? ` · rounding range ${number.format(uncertainty.lower)}–${number.format(uncertainty.upper)}` : '';
  return `${name} · ${number.format(record.value)} ${unit}${range} · month ${record.month} · ${record.districtId}`;
}

export function mountAssembly(host, { onApprove }) {
  const root = element(host, 'section');
  root.className = 'citizen-assembly';
  element(root, 'h2', 'Citizen Assembly');
  element(root, 'p', 'Three fictional delegates and your seat vote on one proposed City policy. Approval needs three support votes and an affordable proposal.');
  element(root, 'p', 'Delegates use the latest available district reading at or before the baseline start and apply their stated thresholds to the reported value. The policy’s effects are measured after the vote.');
  const form = element(root, 'form');
  const proposal = element(element(form, 'label', 'Policy proposal'), 'select');
  const placeholder = element(proposal, 'option', 'Choose a policy');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = true;
  proposal.required = true;
  for (const policy of POLICY_CATALOG.filter(row => row.cost <= ASSEMBLY_BUDGET)) {
    addOption(proposal, `${policy.label} · ${number.format(policy.cost)} modeled USD`, policy.id);
  }
  const visitor = element(element(form, 'label', 'Your vote'), 'select');
  const blank = element(visitor, 'option', 'Choose your vote');
  blank.value = '';
  blank.disabled = true;
  blank.selected = true;
  visitor.required = true;
  for (const vote of ballots) addOption(visitor, voteLabels[vote], vote);
  const submit = element(form, 'button', 'Cast vote');
  const cost = element(root, 'p');
  const seatList = element(root, 'ul');
  seatList.className = 'assembly-seats';
  const status = element(root, 'p');
  status.setAttribute('role', 'status');

  let view = {};
  let busy = false;
  let lastDecision;

  function showSeats(votes, includeVisitor) {
    seatList.replaceChildren();
    for (const row of votes.filter(row => includeVisitor || row.id !== 'visitor')) {
      const seat = element(seatList, 'li');
      element(seat, 'strong', row.name + (row.vote ? ' · ' + voteLabels[row.vote] : ''));
      element(seat, 'p', row.priority);
      if (row.reason) element(seat, 'p', row.reason);
      for (const record of row.evidence ?? []) element(seat, 'p', evidenceLabel(record));
    }
  }

  function showDecision(decision) {
    cost.textContent = `Capital budget ${number.format(decision.budget)} modeled USD · proposed cost ${number.format(decision.cost)} · remaining ${number.format(decision.remainingBudget)}.`;
    showSeats(decision.votes, true);
    status.textContent = (decision.approved ? 'Proposal approved.' : 'Proposal did not pass.') +
      ` ${decision.tally.support} support · ${decision.tally.oppose} oppose · ${decision.tally.abstain} abstain.`;
  }

  function preview() {
    const locked = Boolean(view.approved);
    const disabled = locked || !view.baseline || busy;
    proposal.disabled = visitor.disabled = disabled;
    submit.disabled = disabled || !proposal.value || !visitor.value;
    const approvedDecision = view.approved?.decision ?? view.approved;
    if (locked) {
      const decision = approvedDecision?.version === ASSEMBLY_VERSION ? approvedDecision : lastDecision;
      if (decision) {
        proposal.value = decision.policyId;
        visitor.value = decision.votes.find(row => row.id === 'visitor').vote;
        showDecision(decision);
      } else status.textContent = 'The proposal is locked.';
      return;
    }

    cost.textContent = `Capital budget ${number.format(ASSEMBLY_BUDGET)} modeled USD.`;
    status.textContent = !view.baseline ? 'Open the baseline before deliberating.' : '';
    if (!view.baseline || !proposal.value) {
      showSeats(Object.values(seats), false);
      return;
    }
    try {
      const { decision } = deliberate({
        baseline: view.baseline, observations: view.observations, policyId: proposal.value, visitorVote: 'abstain',
      });
      cost.textContent += ` Proposed cost ${number.format(decision.cost)} · remaining ${number.format(decision.remainingBudget)}.`;
      showSeats(decision.votes, false);
    } catch (error) {
      status.textContent = error.message;
      submit.disabled = true;
    }
  }

  proposal.addEventListener('change', preview);
  visitor.addEventListener('change', preview);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    try {
      const { plan, decision } = deliberate({
        baseline: view.baseline, observations: view.observations, policyId: proposal.value, visitorVote: visitor.value,
      });
      if (!decision.approved) {
        showDecision(decision);
        return;
      }
      lastDecision = decision;
      busy = true;
      preview();
      await onApprove(plan, decision);
      if (!view.approved) showDecision(decision);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      busy = false;
      proposal.disabled = visitor.disabled = Boolean(view.approved) || !view.baseline;
      submit.disabled = proposal.disabled || !proposal.value || !visitor.value;
    }
  });

  preview();
  return {
    render(next) { view = next; preview(); },
    destroy() { root.remove(); },
  };
}
