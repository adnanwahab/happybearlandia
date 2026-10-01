import * as THREE from "three";

export function createDealerButton() {
  const button = new THREE.Group();

  const disk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.08, 32),
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.45,
      metalness: 0.05,
    })
  );

  disk.castShadow = true;
  disk.receiveShadow = true;
  button.add(disk);

  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 256;
  labelCanvas.height = 256;

  const ctx = labelCanvas.getContext("2d");
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#111827";
  ctx.font = "bold 94px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("D", 128, 128);

  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.colorSpace = THREE.SRGBColorSpace;

  const cap = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 32),
    new THREE.MeshBasicMaterial({ map: labelTexture })
  );

  cap.rotation.x = -Math.PI * 0.5;
  cap.position.y = 0.045;
  button.add(cap);

  button.userData.type = "dealer-button";

  return button;
}
