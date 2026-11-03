import {expect, test} from 'bun:test';
import {comedySceneRecords, createComedyEventTracker, comedyPerformanceTarget} from './comedy.js';
import {recordedPose} from './residents.js';

const event = (id, minute = 1) => ({id, minute, episodeId: 'fridge-strike', objectId: 'stove', quote: 'The kitchen has requested annual leave.'});

test('absent or malformed comedy state produces no invented presentation', () => {
  expect(comedySceneRecords({})).toEqual({souvenirs: [], events: [], active: null});
  expect(comedySceneRecords({systems: {comedy: {
    souvenirs: [{id: 'invented', objectId: 'stove', episodeId: 'unknown'}],
    events: [{...event('bad'), minute: NaN}], active: {episodeId: 'fridge-strike'},
  }}})).toEqual({souvenirs: [], events: [], active: null});
});

test('scene retains only bounded real receipts and leaves simulation records unchanged', () => {
  const source = {
    souvenirs: Array.from({length: 6}, (_, i) => ({id: 'souvenir-' + i, objectId: 'stove', episodeId: 'fridge-strike', title: 'Earned title ' + i})),
    events: Array.from({length: 40}, (_, i) => event('event-' + i, i)),
    active: {actionId: 'active', objectId: 'stove', episodeId: 'fridge-strike'},
  };
  const before = JSON.stringify(source);
  const projected = comedySceneRecords({systems: {comedy: source}});
  expect(projected.souvenirs.map(s => s.id)).toEqual(['souvenir-3', 'souvenir-4', 'souvenir-5']);
  expect(projected.events).toHaveLength(32);
  expect(projected.active).toBe(source.active);
  projected.souvenirs[0].title = 'Decorative label changed';
  expect(JSON.stringify(source)).toBe(before);
});

test('restoring a household primes its receipts without replaying old punchlines', () => {
  const tracker = createComedyEventTracker();
  const saved = [event('old-1'), event('old-2')];
  expect(tracker.observe('house-a', saved)).toEqual([]);
  expect(tracker.observe('house-a', saved)).toEqual([]);
  const newEvent = event('new-3', 2);
  expect(tracker.observe('house-a', [...saved, newEvent])).toEqual([newEvent]);
  expect(tracker.observe('house-a', [...saved, newEvent])).toEqual([]);
});

test('household switch and renderer reset prime saved receipts independently', () => {
  const tracker = createComedyEventTracker();
  tracker.observe('house-a', [event('a')]);
  expect(tracker.observe('house-b', [event('b')])).toEqual([]);
  const newest = event('new-b', 3);
  expect(tracker.observe('house-b', [event('b'), newest])).toEqual([newest]);
  tracker.clear();
  expect(tracker.observe('house-b', [event('b'), newest])).toEqual([]);
});

test('catch-up has at most three punchlines and remembers dropped ones', () => {
  const tracker = createComedyEventTracker();
  tracker.observe('house-a', []);
  const batch = Array.from({length: 12}, (_, i) => event('event-' + i, i));
  expect(tracker.observe('house-a', batch).map(e => e.id)).toEqual(['event-9', 'event-10', 'event-11']);
  expect(tracker.observe('house-a', batch)).toEqual([]);
});

test('Three presentation restores earned props, reacts only once, hides removed anchors, and disposes', async () => {
  const THREE = await import('three');
  const {createComedyScene} = await import('./comedy.js');
  const scene = new THREE.Scene();
  const stove = new THREE.Group();
  stove.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, .8, 1), new THREE.MeshBasicMaterial()));
  scene.add(stove);
  const interior = {objects: new Map([['stove', {group: stove}]])};
  const layer = createComedyScene(THREE, scene, interior);
  const souvenir = {id: 'earned', episodeId: 'fridge-strike', objectId: 'stove', title: 'Your Boss Has a Plug', kind: 'fridge-tie'};
  const source = {souvenirs: [souvenir], events: [event('saved')]};
  const data = {home: {householdId: 'house-a', systems: {comedy: source}}};
  layer.update(data, new Map(), 0, {paused: false});
  expect(layer.getDebug().souvenirs.map(s => s.id)).toEqual(['earned']);
  expect(layer.getDebug().effect).toBeNull();
  expect(layer.getPickables().length).toBeGreaterThan(0);

  source.events.push({...event('fresh', 3), type: 'comedy-completed', effect: 'promotion'});
  layer.update(data, new Map(), 1, {paused: true});
  expect(layer.getDebug().effect).toBeNull();
  layer.update(data, new Map(), 1, {paused: false});
  expect(layer.getDebug().effect).toBe('fresh');
  layer.update(data, new Map(), 7, {paused: false});
  layer.update(data, new Map(), 8, {paused: false});
  expect(layer.getDebug().effect).toBeNull();

  interior.objects.delete('stove');
  layer.update(data, new Map(), 9, {paused: false});
  expect(layer.getDebug().souvenirs).toEqual([]);
  expect(layer.getPickables()).toEqual([]);
  let geometryCount = 0, disposals = 0;
  layer.group.traverse(object => {
    if (!object.geometry) return;
    geometryCount++;
    object.geometry.addEventListener('dispose', () => disposals++);
  });
  layer.destroy();
  expect(disposals).toBe(geometryCount);
  expect(scene.children).not.toContain(layer.group);
  stove.children[0].geometry.dispose();
  stove.children[0].material.dispose();
});

test('an earlier checkpoint primes old receipts without a replay in the same renderer', () => {
  const tracker = createComedyEventTracker();
  tracker.observe('house-a', [event('current', 300)], 300);
  expect(tracker.observe('house-a', [event('saved-earlier', 100)], 100)).toEqual([]);
  const fresh = event('new-after-restore', 101);
  expect(tracker.observe('house-a', [event('saved-earlier', 100), fresh], 101)).toEqual([fresh]);
});


test('an attended comedy performance uses its declared talk pose without changing ordinary activities', () => {
  const person = {id: 'actor', ageYears: 30, atHome: true, currentActivity: 'HOME',
    activeAction: {id: 'performance', type: 'comedyPerformance', status: 'requested', elapsedMinutes: 0},
    interaction: {pose: 'talk', objectId: 'actual-stove', objectType: 'stove'}};
  const data = {home: {actions: []}};
  expect(recordedPose(data, person)).toBe('idle');
  person.activeAction.elapsedMinutes = 1;
  person.activeAction.status = 'in-progress';
  expect(recordedPose(data, person)).toBe('talk');
  expect(recordedPose(data, {...person, activeAction: {...person.activeAction, type: 'conversation'}})).toBe('talk');
  expect(recordedPose(data, {...person, activeAction: {...person.activeAction, type: 'cook'}})).toBe('cook');
  expect(recordedPose(data, {...person, activeAction: {...person.activeAction, status: 'completed'}})).toBe('idle');
});

test('comedy targets the selected rotated appliance and the matching real route endpoint', () => {
  const person = {id: 'actor', atHome: true,
    activeAction: {id: 'performance', type: 'comedyPerformance', status: 'in-progress', elapsedMinutes: 2},
    interaction: {pose: 'talk', objectId: 'actual-stove'}};
  const object = {x: 4, z: -2, rotation: Math.PI / 2, scale: .5,
    record: {id: 'actual-stove', type: 'stove', footprint: {depth: 1.4}}};
  const objects = new Map([['actual-stove', object]]), before = structuredClone({person, object});
  const front = comedyPerformanceTarget(person, objects);
  expect(front.objectId).toBe('actual-stove');
  expect(front.x).toBeCloseTo(4.8);
  expect(front.z).toBeCloseTo(-2);
  expect(Math.sin(front.heading)).toBeCloseTo(-1);
  expect(Math.cos(front.heading)).toBeCloseTo(0);
  const navigation = {trips: {actor: {actionId: 'performance', points: [{x: 1, z: 5}, {x: 3, z: 5}]}}};
  expect(comedyPerformanceTarget(person, objects, navigation)).toMatchObject({x: 3, z: 5, objectId: 'actual-stove'});
  navigation.trips.actor.actionId = 'a-different-action';
  expect(comedyPerformanceTarget(person, objects, navigation)).toEqual(front);
  expect(comedyPerformanceTarget({...person, activeAction: {...person.activeAction, type: 'conversation'}}, objects)).toBeNull();
  expect(comedyPerformanceTarget(person, new Map())).toBeNull();
  expect({person, object}).toEqual(before);
});
