import { fetchCheckpoint, replayURL, residentIndex } from '../civilization/families/history.js';
import { ACTIVITIES } from '../population/contracts.js';

export const levels = ['world', 'city', 'district', 'location', 'household', 'resident'];
export const UNMAPPED_HOME = 'unmapped';
const anchorId = location => location ? `anchor:${location.id}` : UNMAPPED_HOME;

export function buildZoomIndex(checkpoint) {
  const { model } = checkpoint;
  const districts = model.districts.map(district => ({
    id: district.id, name: district.label ?? district.id, x: district.x, z: district.z,
    anchors: new Map(), people: 0, households: new Set(),
  }));
  const residentPaths = [];
  const { people, locations } = model;
  for (let index = 0; index < people.age.length; index++) {
    const district = districts[people.home[index]];
    if (!district) continue;
    const location = locations[people.homeLocation[index]];
    const id = anchorId(location);
    let anchor = district.anchors.get(id);
    if (!anchor) {
      anchor = {
        id, buildingId: location?.id ?? null,
        name: location ? (location.name ?? `Building ${location.id}`) : 'Homes without a building anchor',
        x: location?.x, z: location?.z, people: 0, households: new Map(),
      };
      district.anchors.set(id, anchor);
    }
    const householdIndex = people.household[index];
    const householdId = `${model.prefix}-h${householdIndex}`;
    let household = anchor.households.get(householdId);
    if (!household) {
      household = {
        id: householdId, index: householdIndex, residents: [],
        name: model.houseProfiles?.households?.[householdId]?.name ?? `Household ${householdIndex + 1}`,
        totalMembers: model.households.size[householdIndex],
        rent: model.households.rent[householdIndex], savings: model.households.savings[householdIndex],
      };
      anchor.households.set(householdId, household);
    }
    household.residents.push(index);
    anchor.people++;
    district.people++;
    district.households.add(householdId);
    residentPaths[index] = { level: 'resident', district: district.id, location: id, household: householdId,
      person: `${model.prefix}-p${index}` };
  }
  return {
    checkpoint,
    origin: model.worldOrigin ?? null,
    districts: new Map(districts.map(district => [district.id, district])),
    residentPaths,
  };
}

export async function loadZoomIndex(experiment, options) {
  return buildZoomIndex(await fetchCheckpoint(experiment, options));
}

export function personName(model, index) {
  return model.houseProfiles?.people?.[`${model.prefix}-p${index}`]?.name ?? `Resident ${index + 1}`;
}

export function zoomPathFromURL(search) {
  const query = new URLSearchParams(search);
  return {
    level: query.get('level') ?? (query.has('person') ? 'resident' : 'world'), district: query.get('district'),
    location: query.get('location'), household: query.get('household'), person: query.get('person'),
  };
}

export function pathAtLevel(path, level) {
  const rank = levels.indexOf(level);
  return {
    level, district: rank >= 2 ? path.district : null, location: rank >= 3 ? path.location : null,
    household: rank >= 4 ? path.household : null, person: rank >= 5 ? path.person : null,
  };
}

export function zoomURL(experiment, path) {
  const query = new URLSearchParams({ experiment, level: path.level });
  for (const field of ['district', 'location', 'household', 'person']) {
    if (path[field]) query.set(field, path[field]);
  }
  return '/world/civilization-zoom/?' + query;
}

function residentEvidence(index, resident) {
  const { model } = index.checkpoint;
  const person = index.residentPaths[resident].person;
  const links = [];
  for (const tie of Object.values(model.social?.ties ?? {})) {
    const related = tie.a === person ? tie.b : tie.b === person ? tie.a : null;
    const target = residentIndex(model, related);
    if (target < 0 || !index.residentPaths[target]) continue;
    links.push({
      name: personName(model, target), path: index.residentPaths[target],
      kind: tie.kind, lastMinute: tie.lastMinute,
      memories: (tie.memories ?? []).filter(row => row.minute <= model.minute).slice(-12),
    });
  }
  links.sort((a, b) => (b.lastMinute ?? -1) - (a.lastMinute ?? -1));
  const traceKey = `person:${resident}`;
  const traces = model.traces instanceof Map
    ? model.traces.get(traceKey) : model.traces?.find(([id]) => id === traceKey)?.[1];
  const decisions = (traces ?? []).filter(row => row.minute <= model.minute);
  return { links, decisions };
}

export function resolveZoom(index, path) {
  const rank = levels.indexOf(path.level);
  if (rank < 0) throw new Error('The selected zoom level is unavailable.');
  const { id: experiment, model } = index.checkpoint;
  const resident = residentIndex(model, path.person);
  if (rank === 5 && !path.district && !path.location && !path.household) {
    path = index.residentPaths[resident] ?? path;
  }
  const district = index.districts.get(path.district);
  const anchor = district?.anchors.get(path.location);
  const household = anchor?.households.get(path.household);
  if ((rank >= 2 && !district) || (rank >= 3 && !anchor) || (rank >= 4 && !household) ||
      (rank >= 5 && !household.residents.includes(resident))) {
    throw new Error('That selection is unavailable in this exact checkpoint.');
  }

  const view = { rank, path, district, anchor, household, replay: replayURL(experiment) };
  if (rank !== 5) return view;
  const { people } = model;
  const employer = model.economy?.businesses?.[model.employment?.employer[resident]];
  const currentLocation = model.locations[people.currentLocation[resident]];
  const houseQuery = new URLSearchParams({ experiment, person: path.person, playableLife: '1' });
  return {
    ...view,
    resident: {
      id: path.person, name: personName(model, resident), age: people.ageYears?.[resident] ?? null,
      activity: ACTIVITIES[people.activity[resident]] ?? null,
      employment: people.employed[resident] ? (employer?.name ?? 'Employed') :
        people.age[resident] === 0 ? 'Child' : people.age[resident] === 2 ? 'Retired' : 'No recorded job',
      currentLocation: currentLocation?.name ?? currentLocation?.id ?? null,
      house: `/world/house/${encodeURIComponent(household.id)}?${houseQuery}`,
      family: '/world/civilization/families/?' + new URLSearchParams({ experiment, person: path.person }),
      braids: '/world/timeline-braids/?' + new URLSearchParams({ experiment, person: path.person }),
      ...residentEvidence(index, resident),
    },
  };
}

export async function listZoomCheckpoints({ fetcher = fetch, signal } = {}) {
  const response = await fetcher('/api/world-experiments', { signal });
  if (!response.ok) throw new Error('Saved World checkpoints could not be listed.');
  const result = await response.json();
  if (result.schemaVersion !== 'world-experiment-list.v1' || !Array.isArray(result.experiments)) {
    throw new Error('The saved World list has an unsupported format.');
  }
  return result.experiments.filter(record => record.mode === 'living');
}
