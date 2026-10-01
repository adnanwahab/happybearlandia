import * as THREE from "three";

function createPokerChip(color = 0xe11d48) {
  const geometry = new THREE.CylinderGeometry(0.17, 0.17, 0.05, 24);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.18,
  });

  const chip = new THREE.Mesh(geometry, material);
  chip.castShadow = true;
  chip.receiveShadow = true;

  chip.userData.type = "poker-chip";

  return chip;
}

export function createChipStack(
  count,
  position,
  {
    chipColor = 0xe11d48,
    spacing = 0.052,
    maxVisible = 20,
  } = {}
) {
  const group = new THREE.Group();

  const chipsToRender = Math.max(0, Math.min(maxVisible, count));

  for (let i = 0; i < chipsToRender; i++) {
    const chip = createPokerChip(chipColor);
    chip.position.y = i * spacing;
    group.add(chip);
  }

  group.position.copy(position);
  group.userData.type = "poker-chip-stack";

  return group;
}
