import * as THREE from "three";
import { SUIT_TO_SYMBOL } from "../Card.js";

const FACE_TEXTURE_CACHE = new Map();
let BACK_TEXTURE = null;

function createCardFaceTexture(card) {
  const key = `${card.rank}-${card.suit}`;

  if (FACE_TEXTURE_CACHE.has(key)) {
    return FACE_TEXTURE_CACHE.get(key);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;

  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const inkColor = isRed ? "#b71c1c" : "#111827";

  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 12;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = inkColor;
  ctx.font = "bold 96px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(card.rank, 36, 24);

  ctx.font = "92px serif";
  ctx.fillText(SUIT_TO_SYMBOL[card.suit] ?? "?", 36, 122);

  ctx.save();
  ctx.translate(canvas.width * 0.5, canvas.height * 0.5);
  ctx.font = "220px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(SUIT_TO_SYMBOL[card.suit] ?? "?", 0, 0);
  ctx.restore();

  ctx.save();
  ctx.translate(canvas.width, canvas.height);
  ctx.rotate(Math.PI);
  ctx.fillStyle = inkColor;
  ctx.font = "bold 96px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(card.rank, 36, 24);
  ctx.font = "92px serif";
  ctx.fillText(SUIT_TO_SYMBOL[card.suit] ?? "?", 36, 122);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  FACE_TEXTURE_CACHE.set(key, texture);
  return texture;
}

function getBackTexture() {
  if (BACK_TEXTURE) {
    return BACK_TEXTURE;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;

  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#93c5fd";
  ctx.lineWidth = 14;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  ctx.strokeStyle = "#60a5fa";
  ctx.lineWidth = 5;

  for (let y = 40; y < canvas.height - 40; y += 32) {
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(canvas.width - 30, y + 18);
    ctx.stroke();
  }

  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#dbeafe";
  ctx.fillText("🐻", canvas.width * 0.5, canvas.height * 0.5);

  BACK_TEXTURE = new THREE.CanvasTexture(canvas);
  BACK_TEXTURE.colorSpace = THREE.SRGBColorSpace;
  BACK_TEXTURE.needsUpdate = true;

  return BACK_TEXTURE;
}

function createMaterials(card, faceUp) {
  const faceTexture = createCardFaceTexture(card);
  const backTexture = getBackTexture();

  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.7,
    metalness: 0.02,
  });

  const topMaterial = new THREE.MeshStandardMaterial({
    map: faceUp ? faceTexture : backTexture,
    roughness: 0.92,
    metalness: 0.02,
  });

  const bottomMaterial = new THREE.MeshStandardMaterial({
    map: backTexture,
    roughness: 0.92,
    metalness: 0.02,
  });

  return [
    edgeMaterial,
    edgeMaterial,
    topMaterial,
    bottomMaterial,
    edgeMaterial,
    edgeMaterial,
  ];
}

export function createCardMesh(card, options = {}) {
  const {
    faceUp = true,
    width = 0.72,
    height = 1.04,
    thickness = 0.035,
  } = options;

  const geometry = new THREE.BoxGeometry(width, thickness, height);
  const mesh = new THREE.Mesh(geometry, createMaterials(card, faceUp));

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  mesh.userData.type = "poker-card";
  mesh.userData.card = card;
  mesh.userData.faceUp = faceUp;

  mesh.userData.setFaceUp = nextFaceUp => {
    const materials = createMaterials(card, nextFaceUp === true);
    mesh.material = materials;
    mesh.userData.faceUp = nextFaceUp === true;
  };

  return mesh;
}
