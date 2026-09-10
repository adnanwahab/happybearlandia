---
theme: dashboard
title: computer vision for board games
toc: false
---

### 3. Alternative: Load Vanilla Three.js without React in Markdown

If you prefer to bypass React JSX bundling entirely, Observable Framework natively supports HTML elements and standard JavaScript directly in client blocks:



```js
import * as THREE from "npm:three";

const container = document.createElement("div");
container.style.width = "100%";
container.style.height = "500px";
container.style.borderRadius = "8px";
container.style.overflow = "hidden";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 800 / 500, 0.1, 1000);
camera.position.set(0, 12, 15);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth || 800, 500);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(8, 15, 8);
directionalLight.castShadow = true;
scene.add(directionalLight);

const geometry = new THREE.BoxGeometry(16, 0.6, 12);
const material = new THREE.MeshStandardMaterial({ color: 0xffff00, roughness: 0.6 });
const tabletop = new THREE.Mesh(geometry, material);
tabletop.receiveShadow = true;
scene.add(tabletop);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

display(container);

```

# self data collection

Ambient sensors
# biotech with robots
we can have skilled experts run
experiments in bio-reactors and then
the camera data can be used to train
robots to do similar things.
