import { COMMUTE_OPTIONS } from './quests.js';
import { cityMetrics } from '../city/engine.js';

export function mountBuilder(host, { selection, simulate, enter }) {
  host.innerHTML = `
    <h2>World Builder + Time Travel</h2>
    <p>Upgrade transit in the displayed resident’s district. Run two futures from the city you are viewing, then enter either future.</p>
    <label>Proposed transit capacity <select data-capacity></select></label>
    <label>Months ahead <input data-months type="number" min="1" max="24" value="12"></label>
    <button type="button" data-run>Run branch from displayed city</button>
    <p data-status role="status"></p>
    <div data-results hidden>
      <label>Recorded month <input data-time type="range" min="0" value="0"></label>
      <p data-date></p>
      <div class="workspace" data-arms></div>
      <h3>Assumptions and limits</h3><ul data-assumptions></ul>
      <p class="note">Supported means recorded by this synthetic model, conditional on its assumptions. These are not observed real-world effects. Branches remain in this session; reloading discards them.</p>
    </div>`;
  const find = query => host.querySelector(query);
  find('[data-capacity]').replaceChildren(...COMMUTE_OPTIONS.map(row => new Option(`${row.label} · $${row.cost.toLocaleString()} assumed cost`, row.amount)));
  find('[data-capacity]').value = 8;
  let result;
  const format = value => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : 'Unavailable — no recorded observation';
  const node = (tag, text) => { const item = document.createElement(tag); item.textContent = text; return item; };
  function render() {
    const index = Number(find('[data-time]').value);
    find('[data-date]').textContent = `Month ${result.startMonth + index} · Seed ${result.seed} · ${result.modelVersion}`;
    find('[data-arms]').replaceChildren(...['baseline', 'intervention'].map(arm => {
      const snapshot = result[arm][index];
      const metrics = cityMetrics(snapshot.state);
      const card = node('article', '');
      card.className = 'panel';
      card.append(node('h3', arm === 'baseline' ? 'Original future' : 'Proposed transit future'));
      for (const [label, value, source] of [
        ['Commute (min)', snapshot.participant?.commuteMinutes, 'participant trip'],
        ['City balance (USD)', metrics.balance, 'finance.balance'],
        ['Housing units', metrics.housingUnits, 'units inventory'],
        ['Completed projects', metrics.completedProjects, 'projects.stage'],
      ]) card.append(node('p', `${label}: ${format(value)} · ${Number.isFinite(value) ? `Supported · ${source} · month ${snapshot.state.month}` : 'Unavailable'}`));
      const original = cityMetrics(result.baseline[index].state);
      if (arm === 'intervention') {
        card.append(node('p', `Balance change from original: ${format(metrics.balance - original.balance)} USD · Supported · paired finance records`));
      }
      for (const link of snapshot.state.links.filter(row => row.mode === 'transit' && (row.from === result.policy.districtId || row.to === result.policy.districtId))) {
        card.append(node('p', `${link.id}: capacity ${format(link.capacity)} · Supported · links inventory · month ${snapshot.state.month}`));
      }
      const evidence = node('details', '');
      evidence.append(node('summary', `Recorded events (${snapshot.events?.length ?? 0})`));
      for (const event of snapshot.events ?? []) evidence.append(node('p', `${event.eventType} · month ${event.simulationTime} · ${JSON.stringify(event.payload)}`));
      if (!snapshot.events?.length) evidence.append(node('p', 'No events recorded at this checkpoint.'));
      card.append(evidence);
      const button = node('button', arm === 'baseline' ? 'Enter original future' : 'Enter proposed future');
      button.type = 'button';
      button.onclick = () => {
        enter(structuredClone(snapshot));
        find('[data-status]').textContent = `Entered ${arm === 'baseline' ? 'original' : 'proposed'} future · month ${snapshot.state.month}. Network and resident inspection now use this checkpoint.`;
      };
      card.append(button);
      return card;
    }));
  }
  find('[data-time]').oninput = render;
  find('[data-run]').onclick = async () => {
    const button = find('[data-run]');
    button.disabled = true;
    find('[data-status]').textContent = 'Running matched futures…';
    try {
      const next = await simulate('branch', { snapshot: selection(), amount: Number(find('[data-capacity]').value), months: Number(find('[data-months]').value) });
      result = next;
      find('[data-time]').max = result.months;
      find('[data-time]').value = result.months;
      find('[data-assumptions]').replaceChildren(...result.assumptions.map(text => node('li', `Assumption · ${text}`)));
      render();
      find('[data-results]').hidden = false;
      find('[data-status]').textContent = `Branched from month ${result.startMonth}. Original checkpoint preserved.`;
    } catch (error) {
      find('[data-status]').textContent = `Could not run branch. ${error.message}`;
    } finally { button.disabled = false; }
  };
}
