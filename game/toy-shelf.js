// Authored cosmetic playground rules v1. No RNG, civic clock, run or network writes.
export const TOY_OBJECTS = [
  { id: 'toy-honey', type: 'box', position: [6, 0.65, 4], size: [1.25, 1.25, 1.25], motion: 'dynamic', mass: 2, friction: 0.6, color: '#ffbf47' },
  { id: 'toy-berry', type: 'box', position: [9, 0.65, 4], size: [1.25, 1.25, 1.25], motion: 'dynamic', mass: 2, friction: 0.6, color: '#cb85ed' },
];

export function toysForScene(sceneId, objects) {
  // Edited source objects always retain their identities, including ID conflicts.
  return sceneId === '1' && !objects.some(object => TOY_OBJECTS.some(toy => toy.id === object.id)) ? TOY_OBJECTS : [];
}

export function createToyShelf({ physics, getPlayer, getReducedMotion = () => false }) {
  let cooldown = 0;
  let reduced = getReducedMotion();
  const held = new Set();
  const available = () => TOY_OBJECTS.every(toy => physics.has(toy.id));
  // Keep resets at least three metres from the player, including vertical overlap.
  function safe(points) {
    const player = getPlayer();
    return player && [player.x, player.y, player.z].every(Number.isFinite) &&
      points.every(([x, y, z]) => Math.hypot(x - player.x, y - player.y, z - player.z) >= 3);
  }
  function reset(stack = false) {
    const candidates = stack
      ? [[[6, 0.65, 4], [6, 1.92, 4]], [[10, 0.65, 4], [10, 1.92, 4]]]
      : [TOY_OBJECTS.map(toy => toy.position), [[6, 0.65, 7], [10, 0.65, 7]]];
    const points = candidates.find(safe);
    if (!points) return false;
    TOY_OBJECTS.forEach((toy, index) => physics.reset(toy.id, points[index]));
    return true;
  }
  return {
    available,
    act(action, paused = false) {
      if (!available()) return 'Toys unavailable in this scene.';
      if (paused) return 'Close the dialog to play with toys.';
      if (cooldown > 0) return 'Let the toys settle for a moment.';
      if (!['tumble', 'stack', 'reset'].includes(action)) return 'Unknown toy action.';
      if (action === 'tumble' && getReducedMotion()) return 'Reduce motion is on. Try Stack or Reset toys.';
      if (!reset(action === 'stack')) return 'Move away from the toy area to reset safely.';
      if (action === 'tumble') TOY_OBJECTS.forEach((toy, index) => physics.launch(toy.id, [index ? -1 : 1, 4, 0], [0, 0, index ? 2 : -2]));
      cooldown = 0.75;
      return { tumble: 'Toys tumbling!', stack: 'Two-block tower ready. Walk into it!', reset: 'Toys back on the shelf.' }[action];
    },
    update(delta, paused = false) {
      if (paused || !available()) return;
      const nextReduced = getReducedMotion();
      if (nextReduced && !reduced) {
        TOY_OBJECTS.forEach(toy => physics.launch(toy.id, [0, 0, 0], [0, 0, 0]));
        reset();
      }
      reduced = nextReduced;
      cooldown = Math.max(0, cooldown - (Number.isFinite(delta) && delta > 0 ? Math.min(delta, 0.1) : 0));
      const escaped = TOY_OBJECTS.some(toy => {
        const p = physics.position(toy.id);
        return !p || !p.every(Number.isFinite) || p[1] < -2 || p[1] > 12 || p[0] < 3 || p[0] > 13 || p[2] < 1 || p[2] > 10;
      });
      if (escaped) reset();
    },
    gamepad(pads, paused = false) {
      const pressed = new Set();
      let action;
      for (const pad of pads ?? []) {
        if (!pad?.connected || pad.mapping !== 'standard') continue;
        for (const [index, name] of [[0, 'tumble'], [2, 'stack'], [3, 'reset']]) {
          if (!pad.buttons?.[index]?.pressed) continue;
          const key = `${pad.index}:${index}`;
          pressed.add(key);
          if (!held.has(key)) action ??= name;
        }
      }
      held.clear();
      pressed.forEach(key => held.add(key));
      return action && !paused ? this.act(action) : null;
    },
  };
}

export function createJoltToyPhysics(Jolt, bodies, bodyInterface) {
  function velocity(id, linear, angular) {
    const v = new Jolt.Vec3(...linear), w = new Jolt.Vec3(...angular);
    try { bodyInterface.SetLinearAndAngularVelocity(bodies.get(id).GetID(), v, w); }
    finally { Jolt.destroy(v); Jolt.destroy(w); }
  }
  return {
    has: id => bodies.has(id),
    position(id) { const p = bodies.get(id).GetPosition(); return [p.GetX(), p.GetY(), p.GetZ()]; },
    reset(id, point) {
      const p = new Jolt.RVec3(...point), q = new Jolt.Quat(0, 0, 0, 1);
      try {
        velocity(id, [0, 0, 0], [0, 0, 0]);
        bodyInterface.SetPositionAndRotation(bodies.get(id).GetID(), p, q, Jolt.EActivation_Activate);
      } finally { Jolt.destroy(p); Jolt.destroy(q); }
    },
    launch: velocity,
  };
}

export function mountToyShelf(parent, shelf, { getPaused = () => false, getGamepads = () => [] } = {}) {
  const details = document.createElement('details');
  details.id = 'toy-shelf';
  details.innerHTML = `<summary>Physics toy shelf</summary>
    <p>Two local toy blocks ahead and right of spawn. Authored cosmetic play; no civic outcomes. Silent, with no extra visual effects.</p>
    <p>Tab + Enter to play. Standard gamepad while shelf is open: A tumble · X stack · Y reset.</p>
    <button type="button" data-toy="tumble">Tumble</button>
    <button type="button" data-toy="stack">Stack</button>
    <button type="button" data-toy="reset">Reset toys</button>
    <p role="status" aria-live="polite"></p>`;
  const status = details.querySelector('[role="status"]');
  status.textContent = shelf.available() ? 'Ready to play. Toys return if they leave their area.' : 'Toys unavailable in this scene.';
  for (const button of details.querySelectorAll('button')) {
    button.disabled = !shelf.available();
    button.addEventListener('click', event => {
      status.textContent = shelf.act(button.dataset.toy, getPaused());
      if (event.detail > 0) button.blur();
    });
  }
  parent.appendChild(details);
  return {
    update(delta) {
      const paused = getPaused();
      shelf.update(delta, paused);
      let pads = [];
      try { pads = getGamepads(); } catch { /* Keyboard buttons remain available. */ }
      const message = shelf.gamepad(pads, paused || !details.open || document.hidden);
      if (message) status.textContent = message;
    },
  };
}
