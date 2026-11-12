import {test, expect} from 'bun:test';
import {createPopulationModel, stepPopulation, serializePopulation, restorePopulation} from '../population/model.js';
import {applyHouseholdSystemCommand} from './system-command.js';
import {applyHouseholdAction, cancelHouseholdAction, getHouseState, inspectHouse, inspectHouseholdActionAvailability} from './model.js';
import {createGovernmentSystem} from './government-system.js';
import {GOVERNMENT_EPISODES, GOVERNMENT_ACTION, GOVERNMENT_MINUTES} from './government-content.js';
import {createSpatialState} from './spatial-system.js';

const system = createGovernmentSystem();
const fixture = () => createPopulationModel({population: 8, householdSize: 4, seed: 42}, {}, {initialMinute: 360, initialTick: 360});
const hid = model => model.prefix + '-h0';
const pid = (model, index = 0) => model.prefix + '-p' + index;
const home = model => model.houses?.homes?.[0];
const view = model => inspectHouse(model, 0).systems.government;
const request = (model, episodeId = 'fridge-strike', choiceId = 'negotiate', commandId = 'first', extra = {}) => ({householdId: hid(model), system: 'government', type: 'perform', episodeId, choiceId, personId: pid(model), commandId, ...extra});
function perform(model, episodeId, choiceId, commandId = episodeId) {
  const result = applyHouseholdSystemCommand(model, request(model, episodeId, choiceId, commandId));
  stepPopulation(model, {minutes: GOVERNMENT_MINUTES});
  return result;
}
function rejectUnchanged(model, input, pattern) {
  const before = serializePopulation(model);
  expect(() => applyHouseholdSystemCommand(model, input)).toThrow(pattern);
  expect(serializePopulation(model)).toEqual(before);
}

test('legacy inspection is read-only, shows the stove episode, and does not create optional state', () => {
  const model = fixture(), before = serializePopulation(model), result = view(model);
  expect(result.title).toBe('The House Has Formed a Government');
  expect(result.episodes.map(episode => episode.available)).toEqual([true, false, false]);
  expect(result.episodes[0].objectTypes).toContain('stove');
  expect(result.active).toBeNull(); expect(result.memories).toHaveLength(0);
  expect(model.houses).toBeUndefined(); expect(serializePopulation(model)).toEqual(before);
  const restored = restorePopulation(before);
  expect(serializePopulation(restored)).toEqual(before);
});

test('real system dispatch reserves the real stove, earns nothing on click, and completes only after attendance', () => {
  const model = fixture(), money = model.households.savings[0], hunger = model.people.hunger[0], energy = model.people.energy[0];
  const result = applyHouseholdSystemCommand(model, request(model, 'fridge-strike', 'promote-fridge'));
  expect(result.result).toMatchObject({objectId: 'stove', objectType: 'stove', personId: pid(model), durationMinutes: 15});
  expect(model.minute).toBe(360); expect(model.households.savings[0]).toBe(money);
  expect(model.people.hunger[0]).toBe(hunger); expect(model.people.energy[0]).toBe(energy);
  expect(home(model).preparedServings).toBe(0); expect(view(model).memories).toHaveLength(0);
  expect(view(model).active.progress).toBe(0);
  expect(home(model).actions[0].systemData.government).toMatchObject({episodeId: 'fridge-strike', choiceId: 'promote-fridge', personId: pid(model), objectId: 'stove'});
  stepPopulation(model, {minutes: 5});
  expect(view(model).active.progress).toBeCloseTo(1 / 3);
  expect(view(model).memories).toHaveLength(0); expect(view(model).episodes[1].available).toBe(false);
  stepPopulation(model, {minutes: 10});
  const completed = view(model);
  expect(completed.active).toBeNull(); expect(completed.memories).toHaveLength(1);
  expect(completed.episodes[1].available).toBe(true);
  expect(completed.events.at(-1)).toMatchObject({type: 'government-completed', actionId: result.result.actionId, personId: pid(model), objectId: 'stove', speaker: 'Stove', quote: 'Excellent. Your first assignment is to be hot.'});
  expect(completed.souvenirs[0]).toMatchObject({kind: 'fridge-tie', objectId: 'stove'});
  expect(home(model).preparedServings).toBe(0); expect(model.households.savings[0]).toBe(money);
  expect(model.people.hunger[0]).toBeLessThan(hunger); expect(model.people.energy[0]).toBeLessThan(energy);
});

test('partial action checkpoints round-trip exactly and continue to the same deterministic payoff', () => {
  const model = fixture();
  applyHouseholdSystemCommand(model, request(model, 'fridge-strike', 'eat-representative'));
  stepPopulation(model, {minutes: 7});
  const checkpoint = serializePopulation(model), restored = restorePopulation(checkpoint);
  expect(serializePopulation(restored)).toEqual(checkpoint);
  stepPopulation(model, {minutes: 8}); stepPopulation(restored, {minutes: 8});
  expect(serializePopulation(restored)).toEqual(serializePopulation(model));
  expect(view(restored).memories[0].tag).toBe('ate-management');
  const witness = view(restored).events.at(-1).witness;
  if (witness) expect([pid(restored, 1), pid(restored, 2), pid(restored, 3)]).toContain(witness.personId);
});

test('mapped indoor navigation delays the scene, saves during travel, and earns no attendance until arrival', () => {
  const model = fixture(), raw = getHouseState(model, 0);
  raw.systems = {spatial: createSpatialState()};
  model.houses = {schemaVersion: 'house.v1', homes: {0: raw}, active: {}};
  model.houseBuildSites = {0: {status: 'mapped', householdId: hid(model), buildingId: model.locations[model.people.homeLocation[0]]?.id, footprint: {outer: [[-8, -8], [8, -8], [8, 8], [-8, 8]], holes: [], bounds: {minX: -8, maxX: 8, minZ: -8, maxZ: 8}}}};
  const result = applyHouseholdSystemCommand(model, request(model)), action = home(model).actions[0];
  expect(action.start).toBeGreaterThan(model.minute);
  expect(result.result.startedMinute).toBe(action.start);
  expect(home(model).systems.government.active.startedMinute).toBe(action.start);
  expect(home(model).systems.government.active.requestedMinute).toBe(360);
  expect(view(model).active.status).toBe('walking');
  stepPopulation(model, {minutes: (action.start - model.minute) / 2});
  expect(view(model).active.progress).toBe(0); expect(view(model).memories).toHaveLength(0);
  const snapshot = serializePopulation(model), restored = restorePopulation(snapshot);
  expect(serializePopulation(restored)).toEqual(snapshot);
  const remaining = home(model).actions[0].until - model.minute;
  stepPopulation(model, {minutes: remaining}); stepPopulation(restored, {minutes: remaining});
  expect(serializePopulation(restored)).toEqual(serializePopulation(model));
  expect(view(model).memories).toHaveLength(1);
  expect(view(model).memories[0].minute).toBeCloseTo(action.start + 15);
});

test('all nine authored choices complete through real actions, with unique outcomes and actual souvenir anchors', () => {
  for (const [episodeIndex, episode] of GOVERNMENT_EPISODES.entries()) {
    for (const choice of episode.choices) {
      const model = fixture();
      if (choice.requiresPlant) applyHouseholdAction(model, {householdId: hid(model), type: 'furniture', object: 'plant'});
      for (const prior of GOVERNMENT_EPISODES.slice(0, episodeIndex)) perform(model, prior.id, prior.choices[0].id);
      const savings = model.households.savings[0], servings = home(model)?.preparedServings ?? 0;
      perform(model, episode.id, choice.id);
      const result = view(model), memory = result.memories.at(-1), souvenir = result.souvenirs.at(-1);
      expect(memory.tag).toBe(choice.tag); expect(memory.choiceId).toBe(choice.id);
      expect(result.episodes[episodeIndex].completed).toBe(true);
      expect(home(model).objects.some(object => object.id === souvenir.objectId)).toBe(true);
      expect(model.households.savings[0]).toBe(savings); expect(home(model).preparedServings).toBe(servings);
      if (choice.requiresPlant) expect(result.mayor).toMatchObject({personId: null, objectId: 'plant'});
      if (episodeIndex === 2) { expect(result.completed).toBe(true); expect(result.achievements.at(-1).id).toBe('a-functioning-democracy'); }
      expect(() => restorePopulation(serializePopulation(model))).not.toThrow();
    }
  }
});

test('missing plants disable only that candidate; episode order and invalid object choices reject atomically', () => {
  const model = fixture();
  rejectUnchanged(model, request(model, 'sofa-election', 'campaign'), 'Complete');
  rejectUnchanged(model, request(model, 'fridge-strike', 'negotiate', 'wrong-object', {objectId: 'couch'}), 'appliance');
  rejectUnchanged(model, request(model, 'fridge-strike', 'invented'), 'displayed');
  perform(model, 'fridge-strike', 'negotiate');
  const episode = view(model).episodes[1];
  expect(episode.available).toBe(true);
  expect(episode.choices.find(choice => choice.id === 'nominate-plant').available).toBe(false);
  expect(episode.choices.find(choice => choice.id === 'campaign').available).toBe(true);
  rejectUnchanged(model, request(model, 'sofa-election', 'nominate-plant'), 'actual plant');
  perform(model, 'sofa-election', 'sit-on-speech');
  expect(view(model).episodes[2].available).toBe(true);
});

test('foreign, underage, absent, busy, queued and date-bound actors cannot start scenes', () => {
  let model = fixture();
  rejectUnchanged(model, request(model, 'fridge-strike', 'negotiate', 'foreign', {personId: pid(model, 4)}), 'current household');
  rejectUnchanged(model, request(model, 'fridge-strike', 'negotiate', 'invented-person', {personId: 'someone'}), 'actual');
  model.people.ageYears[0] = 12;
  rejectUnchanged(model, request(model), 'adult');
  model = fixture(); model.people.x[0] += 100;
  rejectUnchanged(model, request(model), 'home');
  model = fixture(); applyHouseholdAction(model, {householdId: hid(model), personId: pid(model), type: 'read'});
  rejectUnchanged(model, request(model), 'already');
  model = fixture(); model.houseTasks = {byPerson: {0: [{id: 'queued'}]}};
  rejectUnchanged(model, request(model), 'queued');
  model = fixture(); model.dateAssignments = {0: 0};
  rejectUnchanged(model, request(model), 'date');
});

test('stable command receipts survive restore, reject reused IDs, and never restart a completed episode', () => {
  let model = fixture(); const input = request(model), first = applyHouseholdSystemCommand(model, input);
  const duplicate = applyHouseholdSystemCommand(model, {commandId: input.commandId, personId: input.personId, choiceId: input.choiceId, episodeId: input.episodeId, type: input.type, system: input.system, householdId: input.householdId});
  expect(duplicate.duplicate).toBe(true); expect(duplicate.result.actionId).toBe(first.result.actionId);
  expect(home(model).actions).toHaveLength(1); expect(home(model).systems.government.receipts).toHaveLength(1);
  rejectUnchanged(model, {...input, choiceId: 'promote-fridge'}, 'different choice');
  stepPopulation(model, {minutes: 15}); model = restorePopulation(serializePopulation(model));
  expect(applyHouseholdSystemCommand(model, input).duplicate).toBe(true);
  expect(view(model).memories).toHaveLength(1); expect(home(model).actions).toHaveLength(0);
  rejectUnchanged(model, {...input, commandId: 'new-id'}, 'already');
});

test('a canceled action grants no outcome; a fresh explicit attempt can complete, while forged attendance cannot', () => {
  const model = fixture(), input = request(model), admitted = applyHouseholdSystemCommand(model, input);
  stepPopulation(model, {minutes: 5});
  const actual = home(model).actions[0], fake = {...structuredClone(actual), progress: {[actual.participants[0]]: 15}};
  system.completeAction(model, home(model), fake, actual.until);
  expect(view(model).memories).toHaveLength(0);
  cancelHouseholdAction(model, {householdId: hid(model), personId: pid(model), actionId: admitted.result.actionId});
  system.prepare(model, home(model));
  expect(view(model).active).toBeNull(); expect(view(model).memories).toHaveLength(0);
  expect(view(model).events.at(-1).type).toBe('government-interrupted');
  expect(view(model).episodes[1].available).toBe(false);
  system.completeAction(model, home(model), fake, model.minute);
  expect(view(model).memories).toHaveLength(0);
  expect(applyHouseholdSystemCommand(model, input).duplicate).toBe(true);
  expect(home(model).actions).toHaveLength(0);
  const retry = applyHouseholdSystemCommand(model, {...input, commandId: 'retry'});
  expect(retry.result.actionId).not.toBe(admitted.result.actionId);
  stepPopulation(model, {minutes: 15});
  expect(view(model).memories).toHaveLength(1);
  expect(view(model).memories[0].sourceActionId).toBe(retry.result.actionId);
});

test('generic action entry cannot skip prerequisites, shorten attendance, or impersonate a government outcome', () => {
  const model = fixture(), base = {householdId: hid(model), personId: pid(model), objectId: 'stove', type: GOVERNMENT_ACTION};
  expect(inspectHouseholdActionAvailability(model, base).available).toBe(false);
  const payload = {government: {episodeId: 'fridge-strike', choiceId: 'negotiate', commandId: 'direct', requestedObjectId: null}};
  expect(inspectHouseholdActionAvailability(model, {...base, durationMinutes: 30, systemPayload: payload}).available).toBe(false);
  expect(inspectHouseholdActionAvailability(model, {...base, interrupt: true, systemPayload: payload}).available).toBe(false);
  applyHouseholdAction(model, {...base, type: 'cleanObject', systemPayload: payload});
  stepPopulation(model, {minutes: 15});
  expect(view(model).memories).toHaveLength(0); expect(home(model).systems.government).toBeUndefined();
});

test('normal cooking and bathroom actions remain available before and after the farce', () => {
  const model = fixture();
  expect(inspectHouseholdActionAvailability(model, {householdId: hid(model), personId: pid(model), type: 'cook'}).available).toBe(true);
  perform(model, 'fridge-strike', 'eat-representative');
  expect(inspectHouseholdActionAvailability(model, {householdId: hid(model), personId: pid(model), type: 'cook'}).available).toBe(true);
  perform(model, 'sofa-election', 'campaign'); perform(model, 'porcelain-tribunal', 'demonstrate');
  expect(inspectHouseholdActionAvailability(model, {householdId: hid(model), personId: pid(model), type: 'toilet'}).available).toBe(true);
  expect(home(model).preparedServings).toBe(0);
});

test('callbacks require a later completed actual activity and a committed cooldown, and replay deterministically', () => {
  const model = fixture(); perform(model, 'fridge-strike', 'promote-fridge');
  const clean = target => applyHouseholdAction(target, {householdId: hid(target), personId: pid(target), type: 'cleanObject', objectId: 'stove'});
  for (let count = 0; count < 3; count++) { clean(model); stepPopulation(model, {minutes: 15}); }
  expect(view(model).events.filter(event => event.type === 'government-callback')).toHaveLength(0);
  const before = serializePopulation(model); view(model); view(model);
  expect(serializePopulation(model)).toEqual(before);
  const restored = restorePopulation(before);
  for (const target of [model, restored]) { clean(target); stepPopulation(target, {minutes: 15}); }
  expect(serializePopulation(restored)).toEqual(serializePopulation(model));
  let events = view(model).events.filter(event => event.type === 'government-callback');
  expect(events).toHaveLength(1); expect(events[0].sourceActionId).toBe(view(model).memories[0].sourceActionId);
  expect(events[0].personId).toBe(pid(model)); expect(events[0].objectId).toBe('stove');
  system.advance(model, home(model), {startMinute: model.minute, endMinute: model.minute});
  clean(model); stepPopulation(model, {minutes: 15});
  events = view(model).events.filter(event => event.type === 'government-callback'); expect(events).toHaveLength(1);
  for (let count = 0; count < 3; count++) { clean(model); stepPopulation(model, {minutes: 15}); }
  events = view(model).events.filter(event => event.type === 'government-callback'); expect(events).toHaveLength(2);
  expect(events[0].quote).not.toBe(events[1].quote);
});

test('witnesses are actual present residents, and deleted props are omitted without deleting earned history', () => {
  const model = fixture();
  model.people.x[1] += 100; model.people.x[2] += 100; model.people.x[3] += 100;
  perform(model, 'fridge-strike', 'negotiate');
  expect(view(model).events.at(-1).witness).toBeNull();
  applyHouseholdAction(model, {householdId: hid(model), type: 'deleteObject', objectId: 'stove'});
  expect(view(model).souvenirs).toHaveLength(0); expect(view(model).memories).toHaveLength(1);
  expect(() => restorePopulation(serializePopulation(model))).not.toThrow();
});

test('checkpoint validation rejects future events, corrupted choices, duplicate progress and non-plain state', () => {
  const model = fixture(); applyHouseholdSystemCommand(model, request(model));
  for (const mutate of [
    s => { s.schemaVersion = 'government.unknown'; },
    s => { s.active.choiceId = 'invented'; },
    s => { s.active.personId = pid(model, 1); },
    s => { s.active.commandId = 'forged-command'; },
    s => { s.events[0].minute = model.minute + 100; },
    s => { s.events.push(structuredClone(s.events[0])); },
    s => { s.callbackCount = Infinity; },
    s => { s.receipts[0].result.durationMinutes = 0; },
  ]) {
    const snapshot = serializePopulation(model); mutate(snapshot.houses.homes[0].systems.government);
    expect(() => restorePopulation(snapshot)).toThrow();
  }
  const withDate = serializePopulation(model); withDate.houses.homes[0].systems.government.extra = new Date();
  expect(() => restorePopulation(withDate)).toThrow('plain');
  stepPopulation(model, {minutes: 15});
  const duplicate = serializePopulation(model); duplicate.houses.homes[0].systems.government.completed.push(structuredClone(duplicate.houses.homes[0].systems.government.completed[0]));
  expect(() => restorePopulation(duplicate)).toThrow('progression');
});

test('repeated canceled attempts retain bounded receipts and events without rewards or leaked reservations', () => {
  const model = fixture();
  for (let attempt = 0; attempt < 55; attempt++) {
    const result = applyHouseholdSystemCommand(model, request(model, 'fridge-strike', 'negotiate', 'attempt-' + attempt));
    cancelHouseholdAction(model, {householdId: hid(model), personId: pid(model), actionId: result.result.actionId});
    system.prepare(model, home(model));
  }
  const s = home(model).systems.government;
  expect(s.receipts.length).toBeLessThanOrEqual(48); expect(s.events).toHaveLength(32);
  expect(s.completed).toHaveLength(0); expect(home(model).actions).toHaveLength(0);
  expect(JSON.stringify(s).length).toBeLessThanOrEqual(65536);
  expect(() => restorePopulation(serializePopulation(model))).not.toThrow();
});
