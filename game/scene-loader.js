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
  if (scene.floorTexture !== undefined) {
    if (typeof scene.floorTexture !== 'string' || !scene.floorTexture.trim()) {
      fail('floorTexture must be a non-empty string path');
    }
  }
  if (scene.innerWallTexture !== undefined) {
    if (typeof scene.innerWallTexture !== 'string' || !scene.innerWallTexture.trim()) {
      fail('innerWallTexture must be a non-empty string path');
    }
  }
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
    if (object.modelUrl !== undefined && (typeof object.modelUrl !== 'string' || !object.modelUrl.trim())) fail(`${label}.modelUrl must be a non-empty string path`);
    if (object.texture !== undefined && (typeof object.texture !== 'string' || !object.texture.trim())) fail(`${label}.texture must be a non-empty string path`);
  }
  const tealCube =
    scene.objects.find(
      object =>
        object.id === "teal-cube"
    );

  if (
    tealCube &&
    tealCube.motion !==
      "dynamic"
  ) {
    fail("teal-cube must be dynamic");
  }
  return scene;
}

export async function loadScene(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load scene: HTTP ${response.status}`);
  return validateScene(await response.json());
}

export function validateSceneConversations(data) {
  const fail = message => {
    throw new Error(`Invalid scene conversations: ${message}`);
  };

  if (!data || typeof data !== 'object') {
    fail('expected an object');
  }

  if (!Array.isArray(data.npcs)) {
    fail('npcs must be an array');
  }

  const optionalArrayFields = [
    'npc_relationships',
    'conversation_sessions',
    'conversation_messages',
    'npc_memories',
    'npc_goals',
  ];

  for (const field of optionalArrayFields) {
    if (data[field] !== undefined && !Array.isArray(data[field])) {
      fail(`${field} must be an array when provided`);
    }
  }

  const ids = new Set();

  for (const npc of data.npcs) {
    if (!npc || typeof npc !== 'object') {
      fail('each npc entry must be an object');
    }

    if (typeof npc.id !== 'string' || !npc.id.trim()) {
      fail('each npc needs a non-empty string id');
    }

    if (ids.has(npc.id)) {
      fail(`duplicate npc id: ${npc.id}`);
    }

    ids.add(npc.id);

    const hasConversations = Array.isArray(npc.conversations);
    const hasOpenEndedStarter =
      typeof npc?.conversation_mode?.starter === 'string' &&
      npc.conversation_mode.starter.trim().length > 0;

    if (!hasConversations && !hasOpenEndedStarter) {
      fail(`${npc.id} must define conversations[] or conversation_mode.starter`);
    }

    if (hasConversations && npc.conversations.length === 0 && !hasOpenEndedStarter) {
      fail(`${npc.id}.conversations is empty and no conversation_mode.starter is provided`);
    }
  }

  return data;
}

export async function loadSceneConversations(sceneId) {
  const response = await fetch(
    `/game/conversations/${sceneId}.json`
  );

  if (response.status === 404) {
    return { npcs: [] };
  }

  if (!response.ok) {
    throw new Error(
      `Unable to load conversations for scene ${sceneId}: HTTP ${response.status}`
    );
  }

  return validateSceneConversations(
    await response.json()
  );
}
