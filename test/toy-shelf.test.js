import { test, expect } from 'bun:test';
import initJolt from 'jolt-physics/wasm-compat';
import { TOY_OBJECTS, toysForScene, createToyShelf, createJoltToyPhysics, mountToyShelf } from '../game/toy-shelf.js';
import { validateScene } from '../game/scene-loader.js';
import scene from '../game/scene/1.json';

function fixture() {
  const poses = new Map(TOY_OBJECTS.map(t => [t.id, [...t.position]]));
  const calls = [];
  let player = { x: 0, y: 0, z: 0 }, reduced = false;
  const shelf = createToyShelf({
    physics: { has: id => poses.has(id), position: id => poses.get(id),
      reset(id, p) { poses.set(id, [...p]); calls.push(['reset', id, p]); },
      launch: (...args) => calls.push(['launch', ...args]) },
    getPlayer: () => player, getReducedMotion: () => reduced,
  });
  return { shelf, poses, calls, player: p => player = p, reduce: () => reduced = true,
    settle: () => { for (let i = 0; i < 9; i++) shelf.update(0.1); } };
}

test('authored toys validate without changing existing scene identities or networking', () => {
  const original = structuredClone(scene);
  const combined = validateScene({ ...scene, objects: [...scene.objects, ...TOY_OBJECTS] });
  expect(combined.objects).toHaveLength(70);
  expect(scene).toEqual(original);
  expect(TOY_OBJECTS.every(t => !t.networked && t.mass === 2)).toBe(true);
  expect(toysForScene('1', scene.objects)).toEqual(TOY_OBJECTS);
  expect(toysForScene('2', scene.objects)).toEqual([]);
  expect(toysForScene('1', [...scene.objects, { id: 'toy-honey' }])).toEqual([]);
});

test('tumble, stack and reset use bounded velocities, debounce and clear poses', () => {
  const f = fixture();
  expect(f.shelf.act('tumble')).toBe('Toys tumbling!');
  expect(f.calls.filter(c => c[0] === 'launch')).toHaveLength(2);
  const count = f.calls.length;
  expect(f.shelf.act('stack')).toContain('settle');
  expect(f.calls).toHaveLength(count);
  f.settle();
  expect(f.shelf.act('stack')).toContain('tower ready');
  expect(f.poses.get('toy-berry')).toEqual([6, 1.92, 4]);
  f.settle();
  expect(f.shelf.act('reset')).toContain('back on the shelf');
  expect(f.poses.get('toy-berry')).toEqual(TOY_OBJECTS[1].position);
});

test('escaped, nonfinite and falling toys reset together; blocked or missing states are safe', () => {
  for (const p of [[6, -3, 4], [20, 1, 4], [6, 1, -1], [NaN, 1, 4], [6, 13, 4]]) {
    const f = fixture(); f.poses.set('toy-honey', p); f.shelf.update(0.1);
    expect(f.poses.get('toy-honey')).toEqual(TOY_OBJECTS[0].position);
  }
  const f = fixture();
  f.player({ x: 6, y: 0, z: 4 });
  expect(f.shelf.act('reset')).toContain('back');
  expect(f.poses.get('toy-honey')).toEqual([6, 0.65, 7]);
  f.settle(); f.player({ x: NaN, y: 0, z: 0 });
  expect(f.shelf.act('reset')).toContain('Move away');
  f.poses.delete('toy-berry');
  expect(f.shelf.available()).toBe(false);
  expect(f.shelf.act('stack')).toContain('unavailable');
  expect(() => f.shelf.update(0.1)).not.toThrow();
});

test('reduced motion suppresses tumble, stops existing spin, retains quiet stacking; pause preserves state', () => {
  const f = fixture();
  expect(f.shelf.act('tumble', true)).toContain('Close the dialog');
  expect(f.calls).toHaveLength(0);
  f.shelf.act('tumble'); f.reduce(); f.settle();
  expect(f.calls.filter(c => c[0] === 'launch').slice(-2).map(c => c.slice(2))).toEqual([
    [[0, 0, 0], [0, 0, 0]], [[0, 0, 0], [0, 0, 0]],
  ]);
  expect(f.shelf.act('tumble')).toContain('Reduce motion');
  expect(f.shelf.act('stack')).toContain('tower ready');
  f.poses.set('toy-honey', [0, -20, 0]);
  f.shelf.update(10, true);
  expect(f.poses.get('toy-honey')).toEqual([0, -20, 0]);
});

test('standard gamepad edges, held buttons, disconnection, pause and unsupported mappings', () => {
  const f = fixture();
  const pad = { connected: true, mapping: 'standard', index: 0, buttons: [{ pressed: true }] };
  expect(f.shelf.gamepad([pad])).toContain('tumbling');
  f.settle();
  expect(f.shelf.gamepad([pad])).toBeNull();
  f.shelf.gamepad([]);
  expect(f.shelf.gamepad([pad], true)).toBeNull();
  expect(f.shelf.gamepad([pad])).toBeNull();
  expect(f.shelf.gamepad([{ ...pad, mapping: '' }])).toBeNull();
  expect(f.shelf.gamepad([null])).toBeNull();
  expect(f.shelf.gamepad([pad])).toContain('tumbling');
});

test('real Jolt adapter clears both velocities and restores identity orientation on safe respawn', async () => {
  const J = await initJolt();
  const settings = new J.JoltSettings(); settings.mMaxWorkerThreads = 0;
  const pair = new J.ObjectLayerPairFilterTable(2); pair.EnableCollision(0, 1); pair.EnableCollision(1, 1);
  const broad = new J.BroadPhaseLayerInterfaceTable(2, 2);
  const stationary = new J.BroadPhaseLayer(0), moving = new J.BroadPhaseLayer(1);
  broad.MapObjectToBroadPhaseLayer(0, stationary); broad.MapObjectToBroadPhaseLayer(1, moving);
  settings.mObjectLayerPairFilter = pair; settings.mBroadPhaseLayerInterface = broad;
  settings.mObjectVsBroadPhaseLayerFilter = new J.ObjectVsBroadPhaseLayerFilterTable(broad, 2, pair, 2);
  const engine = new J.JoltInterface(settings); J.destroy(settings);
  const bi = engine.GetPhysicsSystem().GetBodyInterface(), bodies = new Map();
  try {
    for (const toy of TOY_OBJECTS) {
      const half = new J.Vec3(...toy.size.map(n => n / 2)), shape = new J.BoxShape(half, 0.05, null);
      const point = new J.RVec3(...toy.position), q = new J.Quat(0, 0, 0, 1);
      const config = new J.BodyCreationSettings(shape, point, q, J.EMotionType_Dynamic, 1);
      const body = bi.CreateBody(config); bi.AddBody(body.GetID(), J.EActivation_Activate); bodies.set(toy.id, body);
      J.destroy(config); J.destroy(half); J.destroy(point); J.destroy(q);
    }
    const physics = createJoltToyPhysics(J, bodies, bi);
    const shelf = createToyShelf({ physics, getPlayer: () => ({ x: 0, y: 0, z: 0 }) });
    shelf.act('tumble');
    engine.Step(1 / 60, 1);
    expect(bodies.get('toy-honey').GetAngularVelocity().GetZ()).not.toBe(0);
    physics.reset('toy-honey', [6, -5, 4]);
    shelf.update(0.1);
    physics.position('toy-honey').forEach((value, axis) => expect(value).toBeCloseTo(TOY_OBJECTS[0].position[axis], 5));
    for (const body of bodies.values()) {
      expect(body.GetLinearVelocity().Length()).toBe(0);
      expect(body.GetAngularVelocity().Length()).toBe(0);
      expect(body.GetRotation().GetW()).toBe(1);
    }
  } finally {
    for (const body of bodies.values()) { const id = body.GetID(); bi.RemoveBody(id); bi.DestroyBody(id); }
    J.destroy(engine); J.destroy(stationary); J.destroy(moving);
  }
});

test('shelf DOM retains keyboard focus, returns pointer focus and handles denied gamepad access', () => {
  const original = globalThis.document;
  const status = {}, buttons = ['tumble', 'stack', 'reset'].map(action => ({ dataset: { toy: action },
    addEventListener(_, fn) { this.click = fn; }, blur() { this.blurred = true; } }));
  const details = { open: true, querySelector: () => status, querySelectorAll: () => buttons };
  globalThis.document = { createElement: () => details };
  try {
    const f = fixture(); let child;
    const view = mountToyShelf({ appendChild: x => child = x }, f.shelf, { getGamepads: () => { throw Error('denied'); } });
    expect(child.innerHTML).toContain('<summary>Physics toy shelf</summary>');
    expect(child.innerHTML).toContain('role="status"');
    buttons[1].click({ detail: 0 }); expect(buttons[1].blurred).toBeUndefined();
    expect(status.textContent).toContain('tower ready');
    f.settle(); buttons[2].click({ detail: 1 }); expect(buttons[2].blurred).toBe(true);
    expect(() => view.update(0.1)).not.toThrow();
    f.poses.clear();
    mountToyShelf({ appendChild() {} }, f.shelf);
    expect(buttons.every(b => b.disabled)).toBe(true);
    expect(status.textContent).toContain('unavailable');
  } finally { if (original === undefined) delete globalThis.document; else globalThis.document = original; }
});
