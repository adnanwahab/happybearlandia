import { draw } from '../../population/contracts.js';

export const LOCAL_IDEA_RULES = Object.freeze({
  model: 'local-idea.v1', rules: 'radius-sharing.v1', idea: 'drainage-policy-changed',
  source: 'synthetic-fixed-positions.v1', maxResidents: 512, maxTicks: 1000,
});

// Positions are explicit synthetic inputs in meters; one tick is one contact round.
export function runLocalIdea({ residents, originId, seed = 42, ticks = 20,
  radius = 10, probability = 0.65, sharing = true }) {
  if (!Array.isArray(residents) || !residents.length || residents.length > LOCAL_IDEA_RULES.maxResidents ||
      residents.some(r => !r || typeof r.id !== 'string' || !r.id || !Number.isFinite(r.x) || !Number.isFinite(r.y)) ||
      new Set(residents.map(r => r.id)).size !== residents.length || !residents.some(r => r.id === originId))
    throw Error('Invalid residents/origin');
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff ||
      !Number.isSafeInteger(ticks) || ticks < 0 || ticks > LOCAL_IDEA_RULES.maxTicks ||
      !Number.isFinite(radius) || radius < 0 || !Number.isFinite(probability) || probability < 0 || probability > 1 ||
      typeof sharing !== 'boolean') throw Error('Invalid local sharing parameters');
  const positions = residents.map(r => ({ id: r.id, x: r.x, y: r.y })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const recipe = { ...LOCAL_IDEA_RULES, residents: positions, originId, seed, ticks, radius, probability, sharing };
  const events = [{ id: 0, sourceId: null, receiverId: originId, tick: 0, hopCount: 0, parentId: null }];
  const informed = new Map([[originId, events[0]]]);
  const curve = [{ tick: 0, informed: 1 }];
  // Immutable local peer graph; contact order and random draws do not depend on adoption.
  const peers = positions.map(a => positions.map((b, j) => ({ b, j, distance: Math.hypot(a.x - b.x, a.y - b.y) }))
    .filter(p => p.b.id !== a.id && p.distance <= radius));
  for (let tick = 1; tick <= ticks; tick++) {
    const before = new Map(informed);
    if (sharing) for (let i = 0; i < positions.length; i++) {
      const source = before.get(positions[i].id);
      if (!source) continue;
      for (const { b, j, distance } of peers[i]) {
        if (informed.has(b.id)) continue;
        const adoptionDraw = draw(seed, i * positions.length + j, tick, 0);
        if (adoptionDraw >= probability) continue;
        const event = { id: events.length, sourceId: source.receiverId, receiverId: b.id,
          tick, hopCount: source.hopCount + 1, parentId: source.id, distance, adoptionDraw };
        events.push(event);
        informed.set(b.id, event);
      }
    }
    curve.push({ tick, informed: informed.size });
  }
  return { recipe, events, curve, informedIds: [...informed.keys()].sort() };
}

export function compareLocalIdea(options) {
  const treatment = runLocalIdea({ ...options, sharing: true });
  const control = runLocalIdea({ ...options, sharing: false });
  return { schemaVersion: 'local-idea-comparison.v1', treatment, control,
    curve: treatment.curve.map((row, i) => ({ tick: row.tick, sharing: row.informed,
      noSharing: control.curve[i].informed, difference: row.informed - control.curve[i].informed })) };
}

export function validateLocalIdea(run) {
  const replay = runLocalIdea(run.recipe);
  if (JSON.stringify(run) !== JSON.stringify(replay)) throw Error('Local idea replay/provenance mismatch');
  return true;
}
