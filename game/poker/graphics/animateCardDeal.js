import * as THREE from "three";

export function animateCardDeal(cardMesh, target, duration = 350) {
  return new Promise(resolve => {
    const start = cardMesh.position.clone();
    const end = target.clone();
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const smooth = t * t * (3 - 2 * t);

      cardMesh.position.lerpVectors(start, end, smooth);
      cardMesh.position.y += Math.sin(t * Math.PI) * 0.35;

      if (t < 1) {
        requestAnimationFrame(update);
        return;
      }

      cardMesh.position.copy(end);
      resolve();
    }

    requestAnimationFrame(update);
  });
}

export function animateObjectToPosition(object3d, target, duration = 450) {
  return new Promise(resolve => {
    const start = object3d.position.clone();
    const end = target.clone();
    const startedAt = performance.now();

    function tick(now) {
      const elapsed = now - startedAt;
      const t = Math.min(1, elapsed / duration);
      const smooth = t * t * (3 - 2 * t);

      object3d.position.lerpVectors(start, end, smooth);

      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }

      object3d.position.copy(end);
      resolve();
    }

    requestAnimationFrame(tick);
  });
}
