export const STORM_VERSION = 'storm-neighborhood.v1';
export const SIZE = 32;
export const DEFAULTS = Object.freeze({ seed: 2911, rainRate: 0.0012, steps: 60, edits: Object.freeze([]) });
export const EDITS = Object.freeze({
  drain: Object.freeze({ label: 'Add drainage', cost: 120000 }),
  basin: Object.freeze({ label: 'Add detention basin', cost: 250000 }),
  road: Object.freeze({ label: 'Raise road', cost: 80000 }),
});

const cell = (x, y) => y * SIZE + x;
function line(x, y, lastX, lastY) {
  const length = Math.max(Math.abs(lastX - x), Math.abs(lastY - y));
  return Array.from({ length: length + 1 }, (_, i) => cell(
    x + i * Math.sign(lastX - x), y + i * Math.sign(lastY - y),
  ));
}
const road = (id, name, from, to, cells) => Object.freeze({ id, name, from, to, cells: Object.freeze(cells) });
export const roads = Object.freeze([
  road('depot-spur', 'Depot Spur', 'depot', 'center', line(3, 14, 12, 14)),
  road('low-crossing', 'Low Crossing', 'center', 'east', line(12, 14, 25, 14)),
  road('north-rise', 'North Rise', 'center', 'north', line(12, 5, 12, 14)),
  road('ridge-road', 'Ridge Road', 'north', 'ridge', line(12, 5, 25, 5)),
  road('east-slope', 'East Slope', 'ridge', 'east', line(25, 5, 25, 14)),
  road('south-lane', 'South Lane', 'east', 'south', line(25, 14, 25, 25)),
]);

function building(id, name, type, node, x, y, households) {
  const cells = [cell(x, y), cell(x + 1, y), cell(x, y + 1), cell(x + 1, y + 1)];
  return Object.freeze({ id, name, type, node, cells: Object.freeze(cells), ...(households && { households }) });
}
export const buildings = Object.freeze([
  building('depot-clinic', 'Depot Clinic', 'service', 'depot', 5, 10),
  building('center-homes', 'Center Apartments', 'home', 'center', 14, 10, 8),
  building('market', 'Crossing Market', 'business', 'center', 13, 16),
  building('north-homes', 'Ridge Homes', 'home', 'north', 15, 2, 5),
  building('north-store', 'Ridge Supply', 'business', 'ridge', 26, 6),
  building('riverside-clinic', 'Riverside Clinic', 'service', 'east', 26, 16),
  building('east-homes', 'River Court', 'home', 'east', 22, 11, 12),
  building('south-homes', 'South Flats', 'home', 'south', 22, 22, 16),
  building('south-store', 'South Grocery', 'business', 'south', 26, 22),
]);
const roadCells = new Set(roads.flatMap(row => row.cells));
const buildingCells = new Set(buildings.flatMap(row => row.cells));
export const CROSSING_CELL = cell(20, 14);
export const CROSSING_DRAINS = Object.freeze([cell(18, 15), cell(19, 15), cell(20, 15), cell(21, 15)]
  .map(index => Object.freeze({ type: 'drain', cell: index })));

export function normalizeStorm(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      (input.version !== undefined && input.version !== STORM_VERSION)) throw new Error('Unsupported storm recipe version.');
  const { seed, rainRate, steps, edits } = { ...DEFAULTS, ...input };
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Choose a whole-number seed from 0 to 4294967295.');
  if (!Number.isFinite(rainRate) || rainRate < 0 || rainRate > 0.06) throw new Error('Choose rainfall from 0 to 0.06 metres per step.');
  if (!Number.isInteger(steps) || steps < 1 || steps > 100) throw new Error('Choose 1 to 100 storm steps.');
  if (!Array.isArray(edits) || edits.length > 16) throw new Error('Choose up to 16 interventions.');
  const seen = new Set();
  const normalized = edits.map(edit => {
    if (!edit || !Object.hasOwn(EDITS, edit.type) || typeof edit.type !== 'string' ||
        !Number.isInteger(edit.cell) || edit.cell < 0 || edit.cell >= SIZE * SIZE) throw new Error('Invalid intervention.');
    if (seen.has(edit.cell)) throw new Error('Choose only one intervention per cell.');
    seen.add(edit.cell);
    if (edit.type === 'road' && !roadCells.has(edit.cell)) throw new Error('Select a road cell to raise it.');
    if (edit.type === 'basin' && (roadCells.has(edit.cell) || buildingCells.has(edit.cell))) {
      throw new Error('Place detention on an unbuilt cell away from the roads.');
    }
    if (edit.type === 'drain' && buildingCells.has(edit.cell)) throw new Error('Place drainage outside a building footprint.');
    return { type: edit.type, cell: edit.cell };
  });
  return { version: STORM_VERSION, seed, rainRate, steps, edits: normalized.sort((a, b) => a.cell - b.cell) };
}

export function readStorm(encoded) {
  if (encoded === null) return normalizeStorm();
  if (typeof encoded !== 'string' || encoded.length > 1600) throw new Error('This storm recipe is too long.');
  let parsed;
  try { parsed = JSON.parse(encoded); } catch { throw new Error('This storm recipe is invalid.'); }
  if (parsed?.version !== STORM_VERSION) throw new Error('Unsupported storm recipe version.');
  return normalizeStorm(parsed);
}

export function stormCost(recipe) {
  return recipe.edits.reduce((sum, edit) => sum + EDITS[edit.type].cost, 0);
}

export function compileStorm(input) {
  const recipe = normalizeStorm(input);
  const terrain = new Float32Array(SIZE * SIZE);
  const drains = new Float32Array(terrain.length);
  for (let i = 0; i < terrain.length; i++) {
    const x = i % SIZE;
    const y = Math.floor(i / SIZE);
    const bowl = ((x - 20) / 19) ** 2 + ((y - 17) / 16) ** 2;
    terrain[i] = 0.22 + 0.94 * bowl + 0.075 * Math.sin(x * 0.75) * Math.cos(y * 0.49);
  }
  drains[cell(30, 26)] = 0.15;
  drains[cell(30, 27)] = 0.15;
  for (const edit of recipe.edits) {
    if (edit.type === 'drain') drains[edit.cell] += 0.15;
    if (edit.type === 'basin') terrain[edit.cell] -= 0.45;
    if (edit.type === 'road') terrain[edit.cell] += 0.35;
  }
  return { size: SIZE, terrain, drains, rainRate: recipe.rainRate, steps: recipe.steps };
}
