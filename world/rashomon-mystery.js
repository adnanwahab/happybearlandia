import { loadPerspectives } from './civilization/perspectives/model.js';

export const BELIEF_RULES = 'rashomon-beliefs.v1';
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

// Toy attention rule: each role sees only its own checkpoint observation.
// No inference about actual residents' beliefs, news access or flood causality.
export async function loadMystery(fetcher = fetch) {
  const result = await loadPerspectives(fetcher);
  if (result.state !== 'ready') return result;
  const r = result.report;
  if (r.seed !== 2911 || r.month !== 2 || r.affectedUnits !== 7 ||
      r.perspectives.slice(0, 3).some(p => !p.resident)) {
    throw Error('Replay mismatch: pinned Riverside scenario unavailable.');
  }
  const eventId = new URL(r.evidenceLink, 'http://localhost').searchParams.get('targetId');
  const roles = r.perspectives.slice(0, 3);
  const beliefs = roles.map((p, i) => ({
    resident: p.resident, household: p.household, eventId,
    beforeLink: p.beforeLink, afterLink: p.afterLink,
    observation: i === 0 ? `Replacement home: ${p.after.unitId}` :
      i === 1 ? 'No assigned home at month end' : 'Assigned job unreachable this month',
    // Scripted flavor expresses attention, not recorded speech or measured cognition.
    account: ['I remember finding another home.', 'I remember still waiting for a home.',
      'I remember being unable to reach work.'][i],
    cause: 'unknown', otherHouseholds: 'unknown',
  }));
  return freeze({ state: 'ready', ledger: {
    eventId, seed: r.seed, month: r.month, modelVersion: r.modelVersion,
    rulesVersion: BELIEF_RULES, sourceRules: r.rulesVersion,
    affectedUnits: r.affectedUnits, evidenceLink: r.evidenceLink,
    replayLink: r.replayLink,
  }, beliefs });
}

export function mountMystery(root) {
  let generation = 0, result, index = 0;
  const status = root.querySelector('[data-mystery-status]');
  const output = root.querySelector('[data-mystery-output]');
  const next = root.querySelector('[data-mystery-next]');
  const line = text => { const p = document.createElement('p'); p.textContent = text; output.append(p); };
  const link = (text, href) => { const a = document.createElement('a'); a.textContent = text; a.href = href; output.append(a); };
  root.querySelector('[data-mystery-open]').onclick = async () => {
    const token = ++generation; result = null; index = 0; output.replaceChildren(); next.hidden = true;
    status.textContent = 'Reading recorded checkpoints…';
    try {
      const loaded = await loadMystery();
      if (token !== generation) return;
      if (loaded.state !== 'ready') {
        status.textContent = `No source data (${loaded.state}). Record the pinned demo in World Time Machine first.`;
        return;
      }
      result = loaded;
      const l = result.ledger;
      status.textContent = 'Recorded synthetic City event ready. Reveal one account at a time.';
      line(`Factual ledger (model records): event ${l.eventId} · month ${l.month} · ${l.affectedUnits} damaged units · seed ${l.seed} · ${l.modelVersion} · ${l.rulesVersion}`);
      link('Inspect factual source', l.evidenceLink);
      next.hidden = false;
    } catch (error) {
      if (token === generation) status.textContent = `No results: ${error.message}`;
    }
  };
  next.onclick = () => {
    if (!result || index >= result.beliefs.length) return;
    const b = result.beliefs[index++];
    line(`Account ${index}/3 · ${b.resident} · household ${b.household} · source event ${b.eventId}`);
    line(`Modeled belief snapshot (toy attention rule): ${b.observation}. Cause: ${b.cause}; other households: ${b.otherHouseholds}.`);
    line(`Scripted flavor, not recorded speech: “${b.account}”`);
    link('Starting checkpoint', b.beforeLink); link('Month-end checkpoint', b.afterLink);
    if (index === 3) {
      line('Mystery resolved: different local observations support different accounts of the same event. The ledger does not establish what residents actually thought or that the flood caused every change.');
      next.hidden = true;
    }
  };
  root.querySelector('[data-mystery-cancel]').onclick = () => {
    generation++; result = null; output.replaceChildren(); next.hidden = true;
    status.textContent = 'Cancelled. No results retained.';
  };
}
