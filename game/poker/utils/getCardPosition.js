import * as THREE from "three";
import { getPlayerSeatPosition } from "./getPlayerSeatPosition.js";

export function getCardPosition({
  seat,
  playerCount,
  cardIndex,
  center,
  tableY,
  radiusX = 2.45,
  radiusZ = 1.55,
}) {
  const seatPosition = getPlayerSeatPosition(seat, playerCount, {
    center,
    radiusX,
    radiusZ,
    y: tableY,
  });

  const toCenter = new THREE.Vector3(center.x - seatPosition.x, 0, center.z - seatPosition.z).normalize();
  const tangent = new THREE.Vector3(-toCenter.z, 0, toCenter.x).normalize();

  const sideOffset = cardIndex === 0 ? -0.24 : 0.24;

  return seatPosition
    .clone()
    .add(tangent.multiplyScalar(sideOffset))
    .add(toCenter.multiplyScalar(0.2));
}
