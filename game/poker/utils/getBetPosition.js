import * as THREE from "three";
import { getPlayerSeatPosition } from "./getPlayerSeatPosition.js";

export function getBetPosition({
  seat,
  playerCount,
  center,
  tableY,
  seatRadiusX = 2.45,
  seatRadiusZ = 1.55,
  inwardDistance = 0.95,
}) {
  const seatPosition = getPlayerSeatPosition(seat, playerCount, {
    center,
    radiusX: seatRadiusX,
    radiusZ: seatRadiusZ,
    y: tableY,
  });

  const toCenter = new THREE.Vector3(center.x - seatPosition.x, 0, center.z - seatPosition.z).normalize();

  return seatPosition.clone().add(toCenter.multiplyScalar(inwardDistance));
}
