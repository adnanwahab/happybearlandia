// Plain data only: usable by both the browser and external tooling.
export function validateScene(scene) {
  const fail = message => { throw new Error(`Invalid scene: ${message}`); };
  const vector = (value, length, label) => {
    if (!Array.isArray(value) || value.length !== length || !value.every(Number.isFinite)) {
      fail(`${label} must contain ${length} finite numbers`);
    }
  };
  if (!scene || typeof scene !== 'object') fail('expected an object');
  vector(scene.gravity, 3, 'gravity');
  vector(scene.playerSpawn, 3, 'playerSpawn');
  vector(scene.respawnPosition, 3, 'respawnPosition');
  if (!Array.isArray(scene.objects)) fail('objects must be an array');
  const ids = new Set();
  for (const object of scene.objects) {
    if (!object || typeof object.id !== 'string' || !object.id || ids.has(object.id)) {
      fail('each object needs a unique, nonempty id');
    }
    ids.add(object.id);
    const label = object.id;
    if (object.type !== 'box') fail(`${label}: only box geometry is supported`);
    vector(object.position, 3, `${label}.position`);
    vector(object.size, 3, `${label}.size`);
    if (object.size.some(size => size <= 0)) fail(`${label}.size must be positive`);
    if (object.rotation !== undefined) {
      vector(object.rotation, 4, `${label}.rotation`);
      if (Math.abs(Math.hypot(...object.rotation) - 1) > 0.0001) {
        fail(`${label}.rotation must be a unit quaternion [x, y, z, w]`);
      }
    }
    if (!['static', 'dynamic'].includes(object.motion ?? 'static')) fail(`${label}.motion is invalid`);
    if (object.color !== undefined && !/^#[\da-f]{6}$/i.test(object.color)) fail(`${label}.color must be #rrggbb`);
    if (object.mass !== undefined && (!Number.isFinite(object.mass) || object.mass <= 0)) fail(`${label}.mass must be positive`);
    if (object.friction !== undefined && (!Number.isFinite(object.friction) || object.friction < 0)) fail(`${label}.friction must be nonnegative`);
    if (object.speed !== undefined && !Number.isFinite(object.speed)) fail(`${label}.speed must be finite`);
  }
  for (const id of ['lava', 'conveyor', 'teal-cube']) {
    if (!ids.has(id)) fail(`missing gameplay object ${id}`);
  }
  if (scene.objects.find(object => object.id === 'teal-cube').motion !== 'dynamic') {
    fail('teal-cube must be dynamic');
  }
  return scene;
}

export async function loadScene(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load scene: HTTP ${response.status}`);
  return validateScene(await response.json());
}
