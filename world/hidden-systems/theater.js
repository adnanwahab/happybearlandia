const stageLabels = new Map([
  ['proposal', 'Proposal'],
  ['financing', 'Financing'],
  ['permit', 'Permitting'],
  ['construction', 'Construction'],
  ['completion', 'Completed'],
  ['abandoned', 'Abandoned'],
]);
const delayTypes = new Set(['CAPACITY_DELAY', 'MATERIAL_DELAY', 'CAPITAL_PROJECT_DELAYED', 'IMPLEMENTATION_DELAY']);
const ratio = (value, max) => Math.min(1, Math.max(0, value / max));
const ink = '#152b2a';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function stageFor(project) {
  if (!project) return { label: 'No recorded project', fraction: null, complete: false };
  const { stage, progress, duration } = project;
  return {
    label: stageLabels.get(stage) ?? 'Stage unavailable',
    fraction: Number.isFinite(progress) && Number.isFinite(duration) && duration > 0
      ? ratio(progress, duration) : null,
    complete: stage === 'completion',
  };
}

function disposeMeshes(group) {
  group.traverse(object => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
  group.clear();
}

function createScene(THREE, canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(ink);
  const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, .1, 90);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  scene.add(new THREE.HemisphereLight(0xf0fff4, 0x6a7370, 2.3));
  const sun = new THREE.DirectionalLight(0xfff2d7, 2.15);
  sun.position.set(-9, 15, 8);
  scene.add(sun);

  function block(group, { width, height, depth, x = 0, y = height / 2, z = 0, color }) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ color, roughness: .85 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  const context = new THREE.Group();
  const site = new THREE.Group();
  scene.add(context, site);
  block(context, { width: 20, depth: 17, height: .24, y: -.19, color: 0x456560 });
  block(context, { width: 20, depth: 2.4, height: .06, y: -.02, z: 5.1, color: 0x243a38 });
  for (const x of [-8, -5, -2, 1, 4, 7]) {
    block(context, { width: 1.5, depth: .07, height: .02, y: .022, x, z: 5.1, color: 0xd1c68a });
  }
  for (const [x, z, width, height] of [[-6, -3, 2.3, 2.3], [6, -3.8, 2.5, 3.4]]) {
    block(context, { width, depth: 2.8, height, x, z, color: 0x76928a });
    block(context, { width: width + .14, depth: 2.94, height: .12, y: height + .06, x, z, color: 0x95afa5 });
  }

  function setProject(project, stage) {
    disposeMeshes(site);
    if (!project) return;
    const { complete, fraction } = stage;
    const construction = project.stage === 'construction';
    block(site, { width: 7, depth: 6, height: .16, color: complete ? 0x94b8a5 : 0xc6ab6a });
    for (const x of [-3.48, 3.48]) {
      block(site, { width: .075, depth: 6, height: .08, x, y: .2, color: 0xffdb79 });
    }
    for (const z of [-2.98, 2.98]) {
      block(site, { width: 7, depth: .075, height: .08, z, y: .2, color: 0xffdb79 });
    }

    const showsHousing = Boolean(project.buildingId) || project.units > 0;
    const buildingHeight = complete ? 4.6 : construction && fraction !== null ? 4.6 * fraction : 0;
    const height = showsHousing ? buildingHeight : 0;
    if (height > 0) {
      block(site, {
        width: 4.4, depth: 3.5, height, y: .16 + height / 2,
        color: complete ? 0xb9d3bb : 0xc6b898,
      });
      const levels = complete ? 4 : Math.floor(height / 1.12);
      for (let floor = 0; floor < levels; floor++) {
        const y = .73 + floor * 1.1;
        if (!complete) {
          block(site, { width: 4.57, depth: 3.67, height: .1, y: y + .32, color: 0x877f63 });
          continue;
        }
        for (const x of [-1.48, 0, 1.48]) {
          block(site, { width: .75, depth: .055, height: .53, x, y, z: 1.765, color: 0x284c46 });
        }
        for (const x of [-2.21, 2.21]) {
          for (const z of [-.92, .92]) {
            block(site, { width: .055, depth: .62, height: .53, x, y, z, color: 0x284c46 });
          }
        }
      }
      if (complete) {
        block(site, { width: 4.66, depth: 3.74, height: .2, y: 4.86, color: 0x87a997 });
        block(site, { width: .62, depth: .065, height: .85, y: .58, z: 1.78, color: 0x477265 });
      }
    }

    if (construction) {
      block(site, { width: .31, depth: .31, height: 5.55, x: -2.65, z: -2.33, color: 0xf1b54a });
      block(site, { width: 5.35, depth: .23, height: .28, x: -.75, y: 5.58, z: -2.33, color: 0xf1b54a });
      block(site, { width: .07, depth: .07, height: 1.24, x: 1.35, y: 4.85, z: -2.33, color: 0xe6e4cb });
      block(site, { width: .22, depth: .22, height: .23, x: 1.35, y: 4.22, z: -2.33, color: 0xe6e4cb });
    }
  }

  return {
    setProject,
    draw(width, height, angle) {
      const aspect = width / height;
      const halfHeight = Math.max(6.2, 9.5 / aspect);
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.position.set(Math.sin(angle) * 24, 16, Math.cos(angle) * 24);
      camera.lookAt(0, 1, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    },
    destroy() {
      disposeMeshes(site);
      disposeMeshes(context);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export function mountTheater(host) {
  const figure = element('figure', 'construction-theater');
  const viewport = element('div', 'construction-theater__viewport');
  const fallback = element('div', 'construction-theater__fallback');
  const tower = element('div', 'construction-theater__tower');
  fallback.append(tower);
  fallback.setAttribute('aria-hidden', 'true');
  const canvas = element('canvas', 'construction-theater__canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  const cameraControls = element('div', 'construction-theater__camera');
  const rotateLeft = element('button', null, 'Rotate left');
  const rotateRight = element('button', null, 'Rotate right');
  rotateLeft.type = rotateRight.type = 'button';
  cameraControls.append(rotateLeft, rotateRight);
  cameraControls.hidden = true;
  viewport.append(fallback, canvas, cameraControls);

  const caption = element('figcaption', 'construction-theater__caption');
  const title = element('strong', null, 'No recorded project');
  const summary = element('p');
  const delay = element('p', 'construction-theater__delay');
  delay.hidden = true;
  const progress = element('progress');
  progress.max = 1;
  progress.hidden = true;
  progress.setAttribute('aria-label', 'Recorded construction progress');
  const mode = element('p', 'construction-theater__note', 'Schematic elevation');
  caption.append(title, summary, progress, delay, mode);
  figure.append(viewport, caption);
  host.append(figure);

  let scene;
  let project;
  let stage = stageFor(project);
  let angle = .62;
  let destroyed = false;
  let unavailable = false;
  function showFallback() {
    unavailable = true;
    canvas.hidden = true;
    cameraControls.hidden = true;
    fallback.hidden = false;
    mode.textContent = 'Schematic elevation · 3D unavailable';
  }

  function draw() {
    if (!scene || unavailable || destroyed) return;
    const { clientWidth, clientHeight } = viewport;
    if (!clientWidth || !clientHeight) return;
    try {
      scene.draw(clientWidth, clientHeight, angle);
    } catch {
      showFallback();
    }
  }

  function rotate(delta) {
    angle += delta;
    draw();
  }

  const observer = new ResizeObserver(draw);
  observer.observe(viewport);
  rotateLeft.addEventListener('click', () => rotate(-Math.PI / 4));
  rotateRight.addEventListener('click', () => rotate(Math.PI / 4));
  canvas.addEventListener('webglcontextlost', showFallback);

  // The timeline owns all time advancement. The scene draws only on a
  // new checkpoint, a resize, or a user camera action.
  import('/vendor/three/three.module.js').then(THREE => {
    if (destroyed) return;
    scene = createScene(THREE, canvas);
    scene.setProject(project, stage);
    fallback.hidden = true;
    canvas.hidden = false;
    cameraControls.hidden = false;
    mode.textContent = 'Schematic 3D view';
    draw();
  }).catch(() => {
    if (!destroyed) showFallback();
  });

  return {
    render(snapshot, projectId) {
      if (destroyed) return;
      const projects = snapshot?.projects ?? [];
      project = projectId == null ? projects[0] : projects.find(candidate => candidate.id === projectId);
      stage = stageFor(project);
      title.textContent = project ? `${stage.label} · ${project.id}` : stage.label;
      const month = Number.isSafeInteger(snapshot?.month) ? `Month ${snapshot.month}` : '';
      const details = [month];
      if (project) {
        if (project.districtId) details.push(`District ${project.districtId}`);
        if (stage.fraction !== null) details.push(`${project.progress} / ${project.duration} construction ticks`);
        if (Number.isSafeInteger(project.units)) details.push(`${project.units} planned units`);
        if (project.buildingId) details.push(`Building ${project.buildingId}`);
        if (Number.isSafeInteger(project.occupied)) details.push(`${project.occupied} occupied units`);
      }
      summary.textContent = details.filter(Boolean).join(' · ');
      progress.hidden = stage.fraction === null;
      if (stage.fraction !== null) progress.value = stage.fraction;
      const delays = (project?.events ?? []).filter(event => delayTypes.has(event.eventType));
      const reasons = [...new Set(delays.map(event => event.payload?.reason ?? event.eventType.toLowerCase().replaceAll('_', ' ')))];
      delay.hidden = !reasons.length;
      delay.textContent = reasons.length ? `Recorded delays · ${reasons.join(' · ')}` : '';
      fallback.dataset.stage = project?.stage ?? 'empty';
      fallback.dataset.housing = String(Boolean(project?.buildingId) || project?.units > 0);
      tower.style.setProperty('--construction-progress', stage.complete ? 1 : stage.fraction ?? 0);
      if (scene && !unavailable) {
        scene.setProject(project, stage);
        draw();
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', showFallback);
      scene?.destroy();
      figure.remove();
    },
  };
}
