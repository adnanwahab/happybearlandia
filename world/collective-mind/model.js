import { draw } from '../population/contracts.js';

export const MIND_VERSION = 'collective-mind.v1';
export const AGENT_COUNT = 1000;
export const ROUND_COUNT = 60;
export const COMMUNITY_COUNT = 8;
export const COMMUNITY_SIZE = AGENT_COUNT / COMMUNITY_COUNT;
export const NETWORKS = Object.freeze({
  districts: 'Separate districts',
  bridges: 'Districts with bridges',
  citywide: 'Citywide network',
});
export const MIND_DEFAULTS = Object.freeze({
  seed: 42,
  network: 'bridges',
  openness: 0.65,
  question: 'How should the city use a vacant lot?',
  options: Object.freeze(['Build housing', 'Create a park', 'Open a market']),
});

function label(value, limit, name) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) {
    throw new Error(`Enter ${name} of 1–${limit} characters.`);
  }
  return value.trim();
}

export function normalizeMindRecipe(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      (input.version !== undefined && input.version !== MIND_VERSION)) {
    throw new Error('This experiment recipe uses an unsupported format or version.');
  }
  const { seed, network, openness, question, options } = { ...MIND_DEFAULTS, ...input };
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Choose a whole-number seed from 0 to 4294967295.');
  if (!Object.hasOwn(NETWORKS, network)) throw new Error('Choose a supported communication network.');
  if (!Number.isFinite(openness) || openness < 0 || openness > 1) throw new Error('Choose an openness from 0 to 100%.');
  if (!Array.isArray(options) || options.length !== 3) throw new Error('Enter three proposal labels.');
  const names = options.map(option => label(option, 32, 'a proposal label'));
  if (new Set(names.map(name => name.toLowerCase())).size !== names.length) throw new Error('Give each proposal a different label.');
  return { version: MIND_VERSION, seed, network, openness, question: label(question, 120, 'a question'), options: names };
}

export function mindURL(input, round = 0) {
  if (!Number.isInteger(round) || round < 0 || round > ROUND_COUNT) throw new Error('Choose a recorded round.');
  const query = new URLSearchParams({ recipe: JSON.stringify(normalizeMindRecipe(input)) });
  if (round) query.set('round', String(round));
  return '/world/collective-mind/?' + query;
}

export function readMindURL(search) {
  const params = new URLSearchParams(search);
  if (!params.has('recipe')) return { recipe: normalizeMindRecipe(), round: 0 };
  let recipe;
  try {
    const raw = params.get('recipe');
    if (raw.length > 1400) throw new Error();
    recipe = JSON.parse(raw);
    if (recipe?.version !== MIND_VERSION ||
        !['seed', 'network', 'openness', 'question', 'options'].every(key => Object.hasOwn(recipe, key))) {
      throw new Error();
    }
  } catch {
    throw new Error('The experiment link is missing a supported recipe.');
  }
  const rawRound = params.get('round') ?? '0';
  const round = Number(rawRound);
  if (!/^\d+$/.test(rawRound) || !Number.isInteger(round) || round > ROUND_COUNT) throw new Error('The experiment link has an invalid round.');
  return { recipe: normalizeMindRecipe(recipe), round };
}

function buildNetwork({ seed, network }) {
  const neighbors = Array.from({ length: AGENT_COUNT }, () => []);
  const edges = [];
  function connect(a, b) {
    if (a === b || neighbors[a].includes(b)) return;
    neighbors[a].push(b);
    neighbors[b].push(a);
    edges.push([Math.min(a, b), Math.max(a, b)]);
  }

  if (network === 'citywide') {
    const order = Array.from({ length: AGENT_COUNT }, (_, i) => i);
    for (let i = AGENT_COUNT - 1; i > 0; i--) {
      const j = Math.floor(draw(seed, i, 0, 15) * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (let i = 0; i < AGENT_COUNT; i++) {
      for (let offset = 1; offset <= 4; offset++) connect(order[i], order[(i + offset) % AGENT_COUNT]);
    }
  } else {
    for (let district = 0; district < COMMUNITY_COUNT; district++) {
      const start = district * COMMUNITY_SIZE;
      for (let i = 0; i < COMMUNITY_SIZE; i++) {
        for (let offset = 1; offset <= 3; offset++) connect(start + i, start + (i + offset) % COMMUNITY_SIZE);
      }
      if (network === 'bridges') {
        const next = ((district + 1) % COMMUNITY_COUNT) * COMMUNITY_SIZE;
        for (let bridge = 0; bridge < 8; bridge++) {
          connect(start + (bridge * 17 + 5 * district) % COMMUNITY_SIZE,
            next + (bridge * 19 + 7 * district + 9) % COMMUNITY_SIZE);
        }
      }
    }
  }
  return { edges, neighbors };
}

function summarize(frame, edges, changed) {
  const counts = [0, 0, 0];
  for (const preference of frame) counts[preference]++;
  let agreements = 0;
  for (const [a, b] of edges) if (frame[a] === frame[b]) agreements++;
  return { counts, leadingShare: Math.max(...counts) / AGENT_COUNT, agreement: agreements / edges.length, changed };
}

/**
 * The private prior contributes 1–2 votes. Each neighbor contributes one public vote.
 * In ties an agent retains their current choice. Updates read the same previous round.
 */
export function runCollectiveMind(input) {
  const recipe = normalizeMindRecipe(input);
  const { seed, openness } = recipe;
  const { edges, neighbors } = buildNetwork(recipe);
  const initial = Uint8Array.from({ length: AGENT_COUNT }, (_, id) => {
    const favorite = Math.floor(id / COMMUNITY_SIZE) % 3;
    const roll = draw(seed, id, 0, 0);
    return (favorite + (roll < 0.56 ? 0 : roll < 0.78 ? 1 : 2)) % 3;
  });
  const privateWeight = Float32Array.from(initial, (_, id) => 1 + draw(seed, id, 0, 1));
  const frames = [initial];
  const stats = [summarize(initial, edges, 0)];
  const votes = new Float32Array(3);

  for (let round = 1; round <= ROUND_COUNT; round++) {
    const previous = frames.at(-1);
    const frame = new Uint8Array(AGENT_COUNT);
    let changed = 0;
    for (let id = 0; id < AGENT_COUNT; id++) {
      votes.fill(0);
      votes[initial[id]] = privateWeight[id];
      for (const other of neighbors[id]) votes[previous[other]]++;
      let choice = 0;
      let tied = false;
      for (let option = 1; option < 3; option++) {
        if (votes[option] > votes[choice]) {
          choice = option;
          tied = false;
        } else if (votes[option] === votes[choice]) {
          tied = true;
        }
      }
      frame[id] = !tied && draw(seed, id, round, 2) < openness ? choice : previous[id];
      if (frame[id] !== previous[id]) changed++;
    }
    frames.push(frame);
    stats.push(summarize(frame, edges, changed));
  }
  return { recipe, edges, frames, stats };
}
