import {physicalHouseMembers, roommateHome, roommateAtHouse} from './roommate-roster.js';
import {personalityFor} from './relationships.js';
import {
  COMEDY_VERSION, COMEDY_ACTION, COMEDY_ACTIONS, COMEDY_MINUTES,
  COMEDY_CALLBACK_COOLDOWN, COMEDY_EPISODES, COMEDY_PLANTS,
  comedyEpisode, comedyChoice, comedySpeaker, comedySetup, comedyPayoffQuote,
} from './comedy-content.js';

const MAX_BYTES = 65536, copy = value => structuredClone(value);
const check = (condition, message) => { if (!condition) throw Error(message); };
const pid = (model, index) => model.prefix + '-p' + index;
const initial = () => ({schemaVersion: COMEDY_VERSION, active: null, completed: [], receipts: [], events: [], lastCallbackMinute: null, callbackCount: 0, lastCallbackKey: null});
const saved = home => home.systems?.comedy;
function state(home) { home.systems ??= {}; return home.systems.comedy ??= initial(); }
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const text = (value, max = 160) => typeof value === 'string' && value.length > 0 && value.length <= max;
const ordered = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
function household(model, home) {
  const prefix = model.prefix + '-h', index = Number(home.householdId?.slice(prefix.length));
  check(Number.isInteger(index) && index >= 0 && index < model.households.size.length && home.householdId === prefix + index, 'Choose an actual comedy household');
  return index;
}
function personIndex(model, personId) {
  const prefix = model.prefix + '-p', index = typeof personId === 'string' ? Number(personId.slice(prefix.length)) : NaN;
  check(Number.isInteger(index) && index >= 0 && index < model.people.age.length && personId === pid(model, index), 'Choose an actual comedy resident');
  return index;
}
const personName = (model, personId) => model.houseProfiles?.people?.[personId]?.name ?? 'Resident ' + (personIndex(model, personId) + 1);
const roster = (model, home) => physicalHouseMembers(model, household(model, home));
function present(model, home, index) {
  const h = household(model, home), p = model.people, roommate = roommateHome(model, index);
  if (roommate !== null) return roommate === h && roommateAtHouse(model, index, h);
  return p.household[index] === h && !model.visits?.active?.[index] && p.remaining[index] <= 1e-9 && p.current[index] === p.home[index] && Math.hypot(p.x[index] - p.homeX[index], p.z[index] - p.homeZ[index]) < 1;
}
function actorReason(model, home, index) {
  if (!roster(model, home).includes(index)) return 'Choose a current household resident.';
  if (model.people.ageYears[index] < 18) return 'Choose an adult resident for this household farce.';
  if (!present(model, home, index)) return 'Bring this resident home before starting the scene.';
  if (model.dateAssignments?.[index] !== undefined) return 'Finish this resident\'s date before starting a household scene.';
  if (model.houses?.active?.[index] || home.actions?.some(action => action.participants.includes(index))) return 'This resident is already doing an activity.';
  if (model.manualWalks?.[index]) return 'Finish this resident\'s walk first.';
  if (model.houseTasks?.byPerson?.[index]?.length) return 'This resident\'s queued activities come first.';
  return null;
}
const plants = home => home.objects.filter(object => COMEDY_PLANTS.includes(object.type)).sort(ordered);
const liveAction = (home, active = saved(home)?.active) => active ? home.actions?.find(action => action.id === active.actionId && action.type === COMEDY_ACTION) ?? null : null;
function episodeReason(home, episode) {
  const s = saved(home) ?? initial(), index = COMEDY_EPISODES.indexOf(episode);
  if (s.completed.some(row => row.episodeId === episode.id)) return 'This episode is already in the household memories.';
  if (index > 0 && !s.completed.some(row => row.episodeId === COMEDY_EPISODES[index - 1].id)) return 'Complete ' + COMEDY_EPISODES[index - 1].title + ' first.';
  if (liveAction(home)) return 'Let the current comic scene finish first.';
  if (!home.objects.some(object => episode.objectTypes.includes(object.type))) return 'Place a ' + episode.objectTypes.join(' or ') + ' to start this episode.';
  return null;
}
function canonical(input) {
  return JSON.stringify({type: 'perform', episodeId: input.episodeId, choiceId: input.choiceId, personId: input.personId, objectId: input.objectId ?? null});
}
function trim(s) {
  s.events = s.events.slice(-32); s.receipts = s.receipts.slice(-48);
  while (JSON.stringify(s).length > MAX_BYTES && s.receipts.length > 1) s.receipts.shift();
  while (JSON.stringify(s).length > MAX_BYTES && s.events.length > 3) s.events.shift();
}
function record(s, event) { s.events.push(event); trim(s); return event; }
function baseEvent(active, type, minute) {
  return {id: active.actionId + ':' + type, type, minute, actionId: active.actionId, episodeId: active.episodeId, choiceId: active.choiceId, personId: active.personId, objectId: active.objectId, objectType: active.objectType, roomId: active.roomId};
}
function reconcile(model, home) {
  const s = saved(home), active = s?.active;
  if (!active || liveAction(home, active)) return;
  record(s, {...baseEvent(active, 'comedy-interrupted', model.minute), text: 'The scene was interrupted. The household has postponed its nonsense; choose a new attempt when ready.', quote: 'The committee has decided to decide later.', speaker: 'Household', witness: null, effect: 'interrupted'});
  s.active = null;
}

function actionPlan(model, home, request, participants) {
  if (request.type !== COMEDY_ACTION) return null;
  const payload = request.systemPayload?.comedy;
  check(plain(payload) && Object.keys(payload).every(key => ['episodeId', 'choiceId', 'commandId', 'requestedObjectId'].includes(key)), 'Start this scene from a displayed comedy choice');
  check(text(payload.commandId) && (payload.requestedObjectId === null || text(payload.requestedObjectId)), 'Use a stable comedy commandId and object selection');
  const episode = comedyEpisode(payload.episodeId), choice = comedyChoice(payload.episodeId, payload.choiceId);
  check(episode && choice, 'Choose a displayed comedy episode and response');
  check(participants.length === 1 && request.personId === pid(model, participants[0]), 'A comedy scene needs one actual resident');
  check((request.durationMinutes ?? COMEDY_MINUTES) === COMEDY_MINUTES && !request.interrupt, 'A comedy scene uses its full fifteen minutes without replacing another activity');
  const actor = actorReason(model, home, participants[0]); check(!actor, actor);
  const locked = episodeReason(home, episode); check(!locked, locked);
  const object = home.objects.find(item => item.id === request.objectId);
  check(object && episode.objectTypes.includes(object.type) && (!request.roomId || request.roomId === object.roomId), 'Choose the actual appliance for this episode');
  check(payload.requestedObjectId === null || payload.requestedObjectId === object.id, 'Use the selected comedy object');
  const candidate = choice.requiresPlant ? plants(home)[0] : null;
  check(!choice.requiresPlant || candidate, 'Place an actual plant before nominating it; another candidate can run now');
  check(!(saved(home)?.receipts.some(row => row.commandId === payload.commandId)) && !(saved(home)?.completed.some(row => row.commandId === payload.commandId)), 'This comedy command was already admitted; replay the original system command to read its result');
  const requestKey = canonical({episodeId: episode.id, choiceId: choice.id, personId: request.personId, objectId: payload.requestedObjectId});
  return {available: true, data: {episodeId: episode.id, choiceId: choice.id, commandId: payload.commandId, requestKey, personId: request.personId, requestedObjectId: payload.requestedObjectId, objectId: object.id, objectType: object.type, roomId: object.roomId, plantObjectId: candidate?.id ?? null, requestedMinute: model.minute, startedMinute: model.minute, durationMinutes: COMEDY_MINUTES}};
}
function admitAction(model, home, action) {
  if (action.type !== COMEDY_ACTION) return;
  // The action dispatcher has already validated this exact plan and reserved the actor/object.
  reconcile(model, home);
  const s = state(home), data = action.systemData.comedy, episode = comedyEpisode(data.episodeId);
  // Spatial admission runs first and can reserve an indoor route before attendance begins.
  data.startedMinute = action.start;
  s.active = {...copy(data), actionId: action.id};
  const result = {actionId: action.id, episodeId: data.episodeId, choiceId: data.choiceId, personId: data.personId, objectId: data.objectId, objectType: data.objectType, roomId: data.roomId, requestedMinute: model.minute, startedMinute: action.start, until: action.until, durationMinutes: action.durationMinutes, status: 'requested'};
  s.receipts.push({commandId: data.commandId, requestKey: data.requestKey, result});
  record(s, {...baseEvent(s.active, 'comedy-started', model.minute), text: episode.description, quote: comedySetup(episode, data.objectType), speaker: comedySpeaker(episode, data.objectType), witness: null, effect: 'setup'});
}
function command(model, home, input, context = {}) {
  check(plain(input) && input.type === 'perform' && Object.keys(input).every(key => ['type', 'episodeId', 'choiceId', 'personId', 'objectId', 'commandId'].includes(key)), 'Choose a supported comedy performance');
  check(text(input.commandId) && (input.objectId === undefined || text(input.objectId)), 'Use a stable bounded comedy commandId and object selection');
  const key = canonical(input), s = saved(home), receipt = s?.receipts.find(row => row.commandId === input.commandId), completed = s?.completed.find(row => row.commandId === input.commandId);
  if (receipt || completed) {
    const previous = receipt ?? completed;
    check(previous.requestKey === key, 'Do not reuse a comedy commandId for a different choice');
    return {accepted: true, duplicate: true, result: copy(receipt?.result ?? {actionId: completed.actionId, episodeId: completed.episodeId, choiceId: completed.choiceId, personId: completed.personId, objectId: completed.objectId, status: 'completed'})};
  }
  const episode = comedyEpisode(input.episodeId), choice = comedyChoice(input.episodeId, input.choiceId);
  check(episode && choice, 'Choose a displayed comedy episode and response');
  const index = personIndex(model, input.personId), actor = actorReason(model, home, index); check(!actor, actor);
  const locked = episodeReason(home, episode); check(!locked, locked);
  check(!choice.requiresPlant || plants(home).length, 'Place an actual plant before nominating it; another candidate can run now');
  check(typeof context.actionAvailability === 'function' && typeof context.startAction === 'function', 'Use the authoritative household action dispatcher');
  check(!context.householdId || context.householdId === home.householdId, 'Use this actual household for the comedy command');
  const objects = home.objects.filter(object => episode.objectTypes.includes(object.type) && (input.objectId === undefined || input.objectId === object.id)).sort((a, b) => episode.objectTypes.indexOf(a.type) - episode.objectTypes.indexOf(b.type) || ordered(a, b));
  let reason = 'Choose an installed appliance for this comedy episode.';
  for (const object of objects) {
    const request = {type: COMEDY_ACTION, personId: input.personId, objectId: object.id, roomId: object.roomId, systemPayload: {comedy: {episodeId: episode.id, choiceId: choice.id, commandId: input.commandId, requestedObjectId: input.objectId ?? null}}};
    const availability = context.actionAvailability(request);
    if (!availability?.available) { reason = availability?.reason ?? reason; continue; }
    const admitted = context.startAction(request);
    check(admitted?.accepted && text(admitted.actionId, 320), 'The comedy action was not admitted');
    const current = saved(home), stored = current?.receipts.find(row => row.commandId === input.commandId);
    check(stored?.result.actionId === admitted.actionId && current.active?.actionId === admitted.actionId, 'The comedy action needs its authoritative admission hook');
    return {accepted: true, result: copy(stored.result), events: copy(current.events.slice(-1))};
  }
  throw Error(reason);
}

function attended(model, home, action, minute) {
  const actual = home.actions?.find(row => row.id === action.id && row.type === action.type);
  return !!actual && actual.objectId === action.objectId && actual.start === action.start && actual.until === action.until && actual.durationMinutes === action.durationMinutes && Number.isFinite(minute) && minute <= model.minute + 1e-7 && minute >= actual.until - 1e-7 && Number.isFinite(actual.durationMinutes) && actual.durationMinutes > 0 && actual.until === actual.start + actual.durationMinutes && actual.participants?.length > 0 && actual.participants.length === action.participants?.length && actual.participants.every((index, position) => index === action.participants[position] && Number.isInteger(index) && index >= 0 && index < model.people.age.length && present(model, home, index) && (actual.progress?.[index] ?? 0) >= actual.durationMinutes - 1e-7);
}
function witness(model, home, active, choice) {
  const index = roster(model, home).filter(index => pid(model, index) !== active.personId && model.people.ageYears[index] >= 18 && present(model, home, index) && !(model.people.restingUntil?.[index] > model.minute) && !home.actions.some(action => action.participants.includes(index) && ['sleep', 'nap'].includes(action.type))).sort((a, b) => a - b)[0];
  if (index === undefined) return null;
  const personId = pid(model, index), traits = personalityFor(model, personId).traits.map(trait => trait.id);
  let quote = choice.witness, style = 'deadpan';
  if (traits.includes('funny') || traits.includes('playful')) style = 'delighted';
  else if ((traits.includes('neat') || traits.includes('practical')) && choice.id === 'demonstrate') { quote = 'I have added "the air" to the cleaning rota.'; style = 'appalled'; }
  else if (traits.includes('ambitious') && choice.id === 'promote-fridge') { quote = 'I have been passed over for a promotion by an appliance.'; style = 'offended'; }
  else if ((traits.includes('introverted') || traits.includes('reserved')) && choice.id === 'nominate-plant') { quote = 'That plant understands my entire campaign strategy.'; style = 'impressed'; }
  return {personId, name: personName(model, personId), quote, style, basis: 'Scripted reaction from an actual present household resident'};
}
function callback(model, home, action, minute) {
  const s = saved(home);
  if (!s?.completed.length || s.active || minute - (s.lastCallbackMinute ?? -Infinity) < COMEDY_CALLBACK_COOLDOWN || !attended(model, home, action, minute)) return;
  const ids = action.participants.map(index => pid(model, index));
  const candidates = s.completed.filter(memory => home.objects.some(object => object.id === memory.objectId) && (action.objectId === memory.objectId || action.roomId === memory.roomId) && (ids.includes(memory.personId) || ids.includes(memory.witness?.personId)));
  if (!candidates.length) return;
  const source = candidates[s.callbackCount % candidates.length], choice = comedyChoice(source.episodeId, source.choiceId);
  let variant = Math.floor(s.callbackCount / candidates.length) % choice.callbacks.length;
  if (source.episodeId + ':' + variant === s.lastCallbackKey) variant = (variant + 1) % choice.callbacks.length;
  const key = source.episodeId + ':' + variant, quote = choice.callbacks[variant], personId = ids.includes(source.personId) ? source.personId : source.witness.personId;
  record(s, {...baseEvent({...source, actionId: action.id, personId}, 'comedy-callback', minute), id: action.id + ':comedy-callback:' + s.callbackCount, sourceActionId: source.actionId, sourceMemoryId: source.id, text: quote, quote, speaker: source.speaker, witness: null, effect: 'callback'});
  s.callbackCount++; s.lastCallbackMinute = minute; s.lastCallbackKey = key;
}
function completeAction(model, home, action, minute) {
  if (action.type !== COMEDY_ACTION) { callback(model, home, action, minute); return; }
  const s = saved(home), active = s?.active;
  if (!active || active.actionId !== action.id || s.completed.some(row => row.episodeId === active.episodeId) || !attended(model, home, action, minute)) return;
  const data = action.systemData?.comedy, episode = comedyEpisode(active.episodeId), choice = comedyChoice(active.episodeId, active.choiceId);
  if (!data || data.requestKey !== active.requestKey || action.durationMinutes !== COMEDY_MINUTES || action.participants.length !== 1 || pid(model, action.participants[0]) !== active.personId || action.objectId !== active.objectId || !home.objects.some(object => object.id === active.objectId && episode.objectTypes.includes(object.type))) return;
  const reaction = witness(model, home, active, choice), quote = comedyPayoffQuote(episode, choice, active.objectType);
  const row = {...copy(active), id: action.id + ':comedy-memory', minute, title: choice.title, text: choice.text, quote, speaker: comedySpeaker(episode, active.objectType), tag: choice.tag, effect: choice.effect, witness: reaction};
  s.completed.push(row); s.active = null; s.lastCallbackMinute = minute;
  record(s, {...baseEvent(active, 'comedy-completed', minute), title: row.title, text: row.text, quote, speaker: row.speaker, witness: copy(reaction), effect: choice.effect, memoryId: row.id});
}

function activeView(model, home, active) {
  const action = liveAction(home, active); if (!active || !action) return null;
  const episode = comedyEpisode(active.episodeId), index = personIndex(model, active.personId), elapsed = Math.min(action.durationMinutes, Math.max(0, action.progress[index] ?? 0));
  return {...copy(active), title: episode.title, quote: comedySetup(episode, active.objectType), speaker: comedySpeaker(episode, active.objectType), elapsedMinutes: elapsed, remainingMinutes: action.durationMinutes - elapsed, travelRemainingMinutes: Math.max(0, action.start - model.minute), progress: elapsed / action.durationMinutes, status: action.start > model.minute ? 'walking' : elapsed > 0 ? 'in-progress' : 'requested'};
}
function inspect(model, home) {
  const s = saved(home) ?? initial(), actors = roster(model, home).map(index => { const personId = pid(model, index), reason = actorReason(model, home, index); return {personId, name: personName(model, personId), available: !reason, reason, atHome: present(model, home, index), ageYears: model.people.ageYears[index]}; });
  const episodes = COMEDY_EPISODES.map(episode => {
    const outcome = s.completed.find(row => row.episodeId === episode.id), locked = episodeReason(home, episode);
    return {id: episode.id, title: episode.title, description: episode.description, objectTypes: [...episode.objectTypes], durationMinutes: COMEDY_MINUTES, available: !locked, lockedReason: locked, completed: !!outcome, outcome: outcome ? copy(outcome) : null, choices: episode.choices.map(choice => { const reason = locked ?? (choice.requiresPlant && !plants(home).length ? 'Place a real plant to nominate it, or choose another candidate.' : null); return {id: choice.id, label: choice.label, hint: choice.hint, available: !reason, reason}; })};
  });
  const memories = s.completed.map(row => ({id: row.id, title: row.title, text: row.text, tag: row.tag, minute: row.minute, episodeId: row.episodeId, choiceId: row.choiceId, personId: row.personId, objectId: row.objectId, objectType: row.objectType, sourceActionId: row.actionId, witness: copy(row.witness)}));
  const achievements = s.completed.map(row => ({id: 'comedy-' + row.episodeId, title: row.title, description: row.text, episodeId: row.episodeId, minute: row.minute, actionId: row.actionId}));
  if (s.completed.length === COMEDY_EPISODES.length) achievements.push({id: 'a-functioning-democracy', title: 'A Functioning Democracy. Technically.', description: 'The kitchen has a union, the sofa has a mayor, and the toilet has a cabinet position. We used to just live here.', episodeId: 'porcelain-tribunal', minute: s.completed.at(-1).minute, actionId: s.completed.at(-1).actionId});
  const souvenirs = s.completed.flatMap(row => {
    const objectId = row.choiceId === 'nominate-plant' ? row.plantObjectId : row.objectId, object = home.objects.find(item => item.id === objectId);
    return object ? [{id: row.id + ':souvenir', kind: comedyChoice(row.episodeId, row.choiceId).souvenir, objectId, objectType: object.type, personId: row.personId, title: row.title, episodeId: row.episodeId, choiceId: row.choiceId}] : [];
  });
  const election = s.completed.find(row => row.episodeId === 'sofa-election');
  return {schemaVersion: COMEDY_VERSION, title: 'The House Has Formed a Government', description: 'Three domestic disasters. Nine ways to make them worse. Your appliances will remember.', minute: model.minute, episodes, actors, active: activeView(model, home, s.active), memories, events: copy(s.events), achievements, souvenirs, mayor: election ? {personId: election.choiceId === 'nominate-plant' ? null : election.personId, objectId: election.choiceId === 'nominate-plant' ? election.plantObjectId : null, choiceId: election.choiceId} : null, completed: s.completed.length === COMEDY_EPISODES.length, callbackCooldownMinutes: COMEDY_CALLBACK_COOLDOWN};
}

function assertPlain(value, depth = 0) {
  check(depth <= 8, 'Comedy state is too deeply nested');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') { check(Number.isFinite(value), 'Comedy state needs finite numbers'); return; }
  if (typeof value === 'string') { check(value.length <= 1600, 'Comedy text exceeds its bound'); return; }
  if (Array.isArray(value)) { check(value.length <= 64, 'Comedy collection exceeds its bound'); for (const item of value) assertPlain(item, depth + 1); return; }
  check(plain(value) && Object.keys(value).length <= 40, 'Comedy state must be bounded plain data');
  for (const item of Object.values(value)) assertPlain(item, depth + 1);
}
function validateRecord(model, row) {
  const episode = comedyEpisode(row.episodeId), choice = comedyChoice(row.episodeId, row.choiceId);
  check(episode && choice && text(row.commandId) && text(row.actionId, 320) && text(row.objectId) && episode.objectTypes.includes(row.objectType) && ['kitchen', 'living', 'bathroom', 'bedroom', 'study', 'garden'].includes(row.roomId), 'Invalid saved comedy identities');
  personIndex(model, row.personId);
  check(row.requestedObjectId === null || row.requestedObjectId === row.objectId, 'Invalid saved comedy object selection');
  check(row.requestKey === canonical({episodeId: row.episodeId, choiceId: row.choiceId, personId: row.personId, objectId: row.requestedObjectId}), 'Invalid saved comedy request');
  check(Number.isFinite(row.requestedMinute) && row.requestedMinute >= 0 && row.requestedMinute <= model.minute && Number.isFinite(row.startedMinute) && row.startedMinute >= row.requestedMinute && row.durationMinutes === COMEDY_MINUTES, 'Invalid saved comedy attendance');
  check(choice.requiresPlant ? text(row.plantObjectId) : row.plantObjectId === null, 'Invalid saved comedy candidate');
}
function validate(model, home) {
  const s = saved(home); if (s === undefined) return true;
  assertPlain(s);
  check(s.schemaVersion === COMEDY_VERSION && Array.isArray(s.completed) && s.completed.length <= 3 && Array.isArray(s.receipts) && s.receipts.length <= 48 && Array.isArray(s.events) && s.events.length <= 32 && JSON.stringify(s).length <= MAX_BYTES, 'Invalid bounded comedy state');
  check(s.lastCallbackMinute === null || Number.isFinite(s.lastCallbackMinute) && s.lastCallbackMinute >= 0 && s.lastCallbackMinute <= model.minute, 'Invalid comedy callback clock');
  check(Number.isSafeInteger(s.callbackCount) && s.callbackCount >= 0 && (s.lastCallbackKey === null || text(s.lastCallbackKey, 200)), 'Invalid comedy callback sequence');
  const seenCommands = new Set(), seenActions = new Set();
  for (const [index, row] of s.completed.entries()) {
    validateRecord(model, row);
    check(row.episodeId === COMEDY_EPISODES[index].id && !seenCommands.has(row.commandId) && !seenActions.has(row.actionId) && Number.isFinite(row.minute) && row.minute >= row.startedMinute + COMEDY_MINUTES - 1e-7 && row.minute <= model.minute && (!index || row.startedMinute >= s.completed[index - 1].minute), 'Invalid comedy episode progression');
    check(text(row.id, 400) && text(row.title, 200) && text(row.text, 600) && text(row.quote, 500) && text(row.speaker) && row.tag === comedyChoice(row.episodeId, row.choiceId).tag, 'Invalid comedy outcome');
    seenCommands.add(row.commandId); seenActions.add(row.actionId);
    if (row.witness !== null) { check(plain(row.witness) && row.witness.personId !== row.personId && text(row.witness.name) && text(row.witness.quote, 500), 'Invalid comedy witness'); personIndex(model, row.witness.personId); }
  }
  const live = home.actions.filter(action => action.type === COMEDY_ACTION);
  check(live.length <= 1, 'Only one household comedy scene can run at once');
  if (s.active !== null) {
    validateRecord(model, s.active);
    check(s.active.episodeId === COMEDY_EPISODES[s.completed.length]?.id && !seenCommands.has(s.active.commandId) && !seenActions.has(s.active.actionId), 'Invalid active comedy stage');
    const action = liveAction(home, s.active);
    if (action) check(action.participants.length === 1 && pid(model, action.participants[0]) === s.active.personId && action.start === s.active.startedMinute && action.durationMinutes === COMEDY_MINUTES && action.objectId === s.active.objectId && action.roomId === s.active.roomId && action.systemData?.comedy?.requestKey === s.active.requestKey && action.systemData.comedy.commandId === s.active.commandId && action.systemData.comedy.choiceId === s.active.choiceId && action.systemData.comedy.episodeId === s.active.episodeId && action.systemData.comedy.plantObjectId === s.active.plantObjectId, 'Comedy action evidence does not match its saved choice');
  }
  check(!live.length || live[0].id === s.active?.actionId, 'A comedy action is missing its saved choice');
  const receiptIds = new Set();
  for (const receipt of s.receipts) {
    check(text(receipt.commandId) && !receiptIds.has(receipt.commandId) && text(receipt.requestKey, 1600) && plain(receipt.result) && text(receipt.result.actionId, 320) && comedyChoice(receipt.result.episodeId, receipt.result.choiceId) && receipt.result.durationMinutes === COMEDY_MINUTES && Number.isFinite(receipt.result.requestedMinute) && receipt.result.requestedMinute >= 0 && receipt.result.requestedMinute <= model.minute && Number.isFinite(receipt.result.startedMinute) && receipt.result.startedMinute >= receipt.result.requestedMinute && receipt.result.until === receipt.result.startedMinute + COMEDY_MINUTES, 'Invalid comedy command receipt');
    personIndex(model, receipt.result.personId); receiptIds.add(receipt.commandId);
  }
  const eventIds = new Set();
  for (const event of s.events) {
    check(text(event.id, 400) && !eventIds.has(event.id) && ['comedy-started', 'comedy-completed', 'comedy-interrupted', 'comedy-callback'].includes(event.type) && comedyChoice(event.episodeId, event.choiceId) && text(event.objectId) && text(event.actionId, 320) && Number.isFinite(event.minute) && event.minute >= 0 && event.minute <= model.minute && text(event.text, 600) && text(event.quote, 500) && text(event.speaker), 'Invalid retained comedy event');
    personIndex(model, event.personId); eventIds.add(event.id);
    if (event.witness !== null) { check(plain(event.witness) && text(event.witness.name) && text(event.witness.quote, 500), 'Invalid retained comedy witness'); personIndex(model, event.witness.personId); }
  }
  return true;
}

export function createComedySystem() {
  return {id: 'comedy', actions: COMEDY_ACTIONS, command, actionPlan, admitAction, completeAction, inspect, validate,
    prepare: reconcile,
    advance(model, home, {startMinute, endMinute}) {
      if (!saved(home)) return;
      check(Number.isFinite(startMinute) && endMinute >= startMinute && endMinute <= model.minute, 'Use committed comedy intervals');
      reconcile(model, home);
    },
  };
}
