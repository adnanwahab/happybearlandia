import * as THREE from "three";

export function createPokerTable({
  radiusX = 3.2,
  radiusZ = 2.2,
  tableHeight = 1.15,
  topThickness = 0.24,
} = {}) {
  const group = new THREE.Group();

  const felt = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusX, radiusX, topThickness, 48),
    new THREE.MeshStandardMaterial({
      color: 0x166534,
      roughness: 0.8,
      metalness: 0.03,
    })
  );

  felt.scale.set(1, 1, radiusZ / radiusX);
  felt.position.y = tableHeight;
  felt.castShadow = true;
  felt.receiveShadow = true;
  group.add(felt);

  const rail = new THREE.Mesh(
    new THREE.TorusGeometry(radiusX + 0.22, 0.19, 22, 64),
    new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.6,
      metalness: 0.08,
    })
  );

  rail.rotation.x = Math.PI * 0.5;
  rail.scale.set(1, radiusZ / radiusX, 1);
  rail.position.y = tableHeight + 0.08;
  rail.castShadow = true;
  rail.receiveShadow = true;
  group.add(rail);

  const legMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b3f1d,
    roughness: 0.55,
    metalness: 0.1,
  });

  const legOffsets = [
    [0.95, 0.72],
    [-0.95, 0.72],
    [0.95, -0.72],
    [-0.95, -0.72],
  ];

  for (const [x, z] of legOffsets) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, tableHeight, 18),
      legMaterial
    );

    leg.position.set(x * radiusX, tableHeight * 0.5, z * radiusZ);
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);
  }

  group.userData.type = "fallback-poker-table";

  return group;
}
