import * as THREE from "three";

export function getPlayerSeatPosition(
  seat,
  playerCount,
  {
    center = new THREE.Vector3(),
    radiusX = 3,
    radiusZ = 2,
    y = 2,
    seatOffset = 0,
  } = {}
) {
  const angle = (seat / Math.max(1, playerCount)) * Math.PI * 2 + seatOffset;

  return new THREE.Vector3(
    center.x + Math.sin(angle) * radiusX,
    y,
    center.z + Math.cos(angle) * radiusZ,
  );
}
