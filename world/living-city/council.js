const stakeholders = [
  {
    id: 'commuters',
    name: 'Commuting residents',
    metric: 'commuteMinutes',
    label: 'Mean commute',
    unit: 'min',
    goal: 'Support shorter commutes. Oppose longer commutes.',
    direction: -1,
  },
  {
    id: 'renters',
    name: 'Renters',
    metric: 'meanRent',
    label: 'Mean rent',
    unit: 'modeled currency/month',
    goal: 'Support lower mean rent. Oppose higher mean rent.',
    direction: -1,
  },
  {
    id: 'employers',
    name: 'Local employers',
    metric: 'employed',
    label: 'Employed residents',
    unit: 'people',
    goal: 'Support higher employment. Oppose lower employment.',
    direction: 1,
  },
  {
    id: 'services',
    name: 'Public service operators',
    metric: 'overloadedServices',
    label: 'Overloaded facilities',
    unit: 'facilities',
    goal: 'Support fewer overloaded facilities. Oppose increases in overload.',
    direction: -1,
  },
];

const treasury = {
  id: 'treasury',
  name: 'City treasurer',
  metric: 'balance',
  label: 'City balance',
  unit: 'modeled currency',
  goal: 'Support a proposal within the baseline balance if the projected balance stays nonnegative. Oppose a proposal that exceeds the balance or projects a deficit.',
};

const voteLabels = { support: 'Support', oppose: 'Oppose', hold: 'Hold' };
const voteOrder = ['support', 'oppose', 'hold'];
const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

const measured = value => Number.isFinite(value) ? value : null;
const number = value => format.format(value);

function metricVote(stakeholder, before, after) {
  const initial = { vote: 'hold', reason: 'Awaiting paired outcomes.' };
  if (before === null || after === null) {
    return { initial, current: { vote: 'hold', reason: 'Both measurements are required for this vote.' } };
  }
  const difference = (after - before) * stakeholder.direction;
  if (difference === 0) {
    return { initial, current: { vote: 'hold', reason: 'The measured outcome is unchanged.' } };
  }
  const vote = difference > 0 ? 'support' : 'oppose';
  const reason = difference > 0 ? 'The outcome advances this goal.' : 'The outcome works against this goal.';
  return { initial, current: { vote, reason } };
}

function treasuryVote(before, after, cost) {
  if (before === null || cost === null || cost < 0) {
    const hold = { vote: 'hold', reason: 'The treasury needs a measured baseline balance and a valid proposal cost.' };
    return { initial: hold, current: hold };
  }
  if (cost > before) {
    const oppose = { vote: 'oppose', reason: 'The proposal cost exceeds the baseline balance.' };
    return { initial: oppose, current: oppose };
  }
  const initial = { vote: 'support', reason: 'The proposal cost fits within the baseline balance.' };
  if (after === null) {
    return { initial, current: { vote: 'hold', reason: 'The projected balance is unavailable.' } };
  }
  const current = after >= 0
    ? { vote: 'support', reason: 'The cost fits within the baseline balance and the projected balance stays nonnegative.' }
    : { vote: 'oppose', reason: 'The projected city balance is negative.' };
  return { initial, current };
}

export function evaluateLivingCouncil({ before, after, proposal }) {
  const cost = measured(proposal?.cost);
  const positions = [...stakeholders, treasury].map(stakeholder => {
    const baseline = measured(before?.[stakeholder.metric]);
    const outcome = measured(after?.[stakeholder.metric]);
    const { initial, current } = stakeholder.id === treasury.id
      ? treasuryVote(baseline, outcome, cost)
      : metricVote(stakeholder, baseline, outcome);
    return { ...stakeholder, baseline, outcome, initial, current: after == null ? initial : current };
  });
  const tally = Object.fromEntries(voteOrder.map(vote => [
    vote, positions.filter(position => position.current.vote === vote).length,
  ]));
  const coalitions = voteOrder.slice(0, 2).map(vote => ({
    vote,
    members: positions.filter(position => position.current.vote === vote).map(position => position.name),
  })).filter(group => group.members.length > 1);
  return { positions, tally, coalitions };
}

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function evidence(position) {
  const values = element('dl', undefined, 'living-council__evidence');
  for (const [label, metric] of [['Baseline', position.baseline], ['With proposal', position.outcome]]) {
    const group = element('div');
    const value = metric === null ? 'Unavailable' : `${number(metric)} ${position.unit}`;
    group.append(element('dt', label), element('dd', value));
    values.append(group);
  }
  return values;
}

function renderPosition(position, expanded, compared) {
  const card = element('details', undefined, 'living-council__position');
  card.open = expanded;
  card.dataset.stakeholder = position.id;
  const summary = element('summary');
  const vote = element('span', voteLabels[position.current.vote], 'living-council__vote');
  vote.dataset.vote = position.current.vote;
  summary.append(element('strong', position.name), vote);
  const content = element('div', undefined, 'living-council__motivation');
  content.append(element('p', position.goal), element('p', position.label), evidence(position));
  if (compared) content.append(element('p', `At proposal · ${voteLabels[position.initial.vote]}. ${position.initial.reason}`));
  content.append(element('p', position.current.reason));
  card.append(summary, content);
  return card;
}

export function mountLivingCouncil(host) {
  host.classList.add('living-council');
  const heading = element('h2', 'Living City Council');
  const note = element('p', 'Illustrative voting rules applied to modeled city outcomes.');
  const content = element('div', undefined, 'living-council__content');
  host.replaceChildren(heading, note, content);

  function update(input) {
    const expanded = new Set([...content.querySelectorAll('details[open]')].map(node => node.dataset.stakeholder));
    if (!input?.proposal) {
      content.replaceChildren(element('p', 'Test a proposal to see how council members respond.'));
      return;
    }
    const { proposal, after } = input;
    const { positions, tally, coalitions } = evaluateLivingCouncil(input);
    const title = element('h3', proposal.label);
    const cost = measured(proposal.cost);
    const proposalCost = element('p', cost === null || cost < 0
      ? 'Proposal cost unavailable'
      : `Proposal cost · ${number(cost)} modeled currency`);
    const tallyText = element('p', voteOrder.map(vote => `${tally[vote]} ${vote}`).join(' · '), 'living-council__tally');
    tallyText.setAttribute('role', 'status');
    const cards = element('div', undefined, 'living-council__positions');
    cards.append(...positions.map(position => renderPosition(position, expanded.has(position.id), after != null)));
    const groups = element('div', undefined, 'living-council__coalitions');
    if (coalitions.length > 0) {
      const list = element('ul');
      list.append(...coalitions.map(group => element('li', `${voteLabels[group.vote]} · ${group.members.join(', ')}`)));
      groups.append(element('h4', 'Voting coalitions'), list);
    }
    content.replaceChildren(title, proposalCost, tallyText, cards, groups);
  }

  update(null);
  return update;
}
