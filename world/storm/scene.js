const verticalScale = 2;
const dryLow = '#4d6c5d';
const dryHigh = '#a2b08d';
const waterColors = ['#70c9d7', '#328db2', '#22649e'];
const buildingColors = { home: '#efd49e', business: '#d5b0a1', service: '#e9e7cd' };
const roadColor = '#253c42';
const selectionColor = '#ffdb71';
const depthBand = depth => depth < .1 ? 0 : depth < .4 ? 1 : 2;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function validCell(index, size) {
  return Number.isInteger(index) && index >= 0 && index < size * size;
}

function prepareFrame(input) {
  const { size, terrain, depth, selected, buildings = [], roads = [] } = input;
  if (!Number.isInteger(size) || size < 1 || terrain?.length !== size * size ||
      depth?.length !== size * size) throw new Error('The storm frame does not match its grid size.');
  const buildingAt = new Map();
  const roadAt = new Map();
  for (const building of buildings) {
    for (const cell of building.cells) if (validCell(cell, size)) buildingAt.set(cell, building);
  }
  for (const road of roads) {
    for (const cell of road.cells) if (validCell(cell, size)) roadAt.set(cell, road);
  }
  return { size, terrain, depth, selected: validCell(selected, size) ? selected : null, buildingAt, roadAt };
}

function drawMap(canvas, frame) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const { size, terrain, depth, selected, buildingAt, roadAt } = frame;
  const tile = 14;
  if (canvas.width !== size * tile) canvas.width = canvas.height = size * tile;
  for (let cell = 0; cell < terrain.length; cell++) {
    const x = (cell % size) * tile;
    const y = Math.floor(cell / size) * tile;
    const light = 29 + Math.max(0, Math.min(1, terrain[cell] / 2.5)) * 29;
    context.fillStyle = depth[cell] > 0 ? waterColors[depthBand(depth[cell])] : `hsl(146 15% ${light}%)`;
    context.fillRect(x, y, tile, tile);
    context.strokeStyle = '#102d344b';
    context.lineWidth = .65;
    context.strokeRect(x, y, tile, tile);
    const building = buildingAt.get(cell);
    if (building) {
      context.fillStyle = buildingColors[building.type] ?? buildingColors.service;
      context.fillRect(x + 3, y + 3, tile - 6, tile - 6);
    } else if (roadAt.has(cell)) {
      context.strokeStyle = roadColor;
      context.lineWidth = 2;
      context.strokeRect(x + 3, y + 3, tile - 6, tile - 6);
    }
  }
  if (selected !== null) {
    context.strokeStyle = selectionColor;
    context.lineWidth = 3;
    context.strokeRect((selected % size) * tile + 1.5, Math.floor(selected / size) * tile + 1.5, tile - 3, tile - 3);
  }
}

function createTerrainRenderer(THREE, canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#112d35');
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 1024);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  scene.add(new THREE.HemisphereLight(0xe9f7ed, 0x698786, 2.1));
  const light = new THREE.DirectionalLight(0xfff5d8, 2.1);
  light.position.set(-14, 25, 7);
  scene.add(light);

  const box = new THREE.BoxGeometry(1, 1, 1);
  const surface = new THREE.MeshStandardMaterial({ roughness: .85 });
  const waterMaterial = new THREE.MeshStandardMaterial({ roughness: .44 });
  const markerMaterial = new THREE.MeshBasicMaterial({ color: selectionColor });
  const marker = new THREE.Group();
  const markerEdges = [[0, -.45, .94, .058], [0, .45, .94, .058],
    [-.45, 0, .058, .88], [.45, 0, .058, .88]];
  for (const [x, z, width, length] of markerEdges) {
    const edge = new THREE.Mesh(box, markerMaterial);
    edge.scale.set(width, .055, length);
    edge.position.set(x, 0, z);
    marker.add(edge);
  }
  marker.visible = false;
  scene.add(marker);

  const matrix = new THREE.Matrix4();
  const dryStart = new THREE.Color(dryLow);
  const dryEnd = new THREE.Color(dryHigh);
  const color = new THREE.Color();
  const pickRay = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let size = 0;
  let layers = [];
  let width;
  let height;

  function layer(material, capacity) {
    const mesh = new THREE.InstancedMesh(box, material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), size * 3 + 20);
    mesh.count = 0;
    scene.add(mesh);
    return { mesh, cells: [], count: 0 };
  }

  function clearLayers() {
    for (const { mesh } of layers) {
      scene.remove(mesh);
      mesh.dispose();
    }
  }

  function resizeLayers(nextSize) {
    clearLayers();
    size = nextSize;
    const capacity = size * size;
    layers = [layer(surface, capacity), layer(waterMaterial, capacity),
      layer(surface, capacity), layer(surface, capacity * 2)];
  }

  function place(target, cell, x, y, z, w, h, d, tint) {
    const index = target.count++;
    matrix.makeScale(w, h, d).setPosition(x, y, z);
    target.mesh.setMatrixAt(index, matrix);
    target.mesh.setColorAt(index, color.set(tint));
    target.cells[index] = cell;
  }

  function render(frame, nextWidth, nextHeight) {
    if (frame.size !== size) resizeLayers(frame.size);
    const { terrain, depth, selected, buildingAt, roadAt } = frame;
    const [land, water, road, buildings] = layers;
    for (const target of layers) target.count = 0;
    marker.visible = selected !== null;
    for (let cell = 0; cell < terrain.length; cell++) {
      const row = Math.floor(cell / size);
      const col = cell % size;
      const x = col + .5 - size / 2;
      const z = row + .5 - size / 2;
      const top = terrain[cell] * verticalScale;
      const waterHeight = depth[cell] > 0 ? Math.max(.025, depth[cell] * verticalScale) : 0;
      const base = Math.min(-1, top - .4);
      color.copy(dryStart).lerp(dryEnd, Math.max(0, Math.min(1, terrain[cell] / 2.5)));
      place(land, cell, x, (top + base) / 2, z, .99, top - base, .99, color);
      if (waterHeight > 0) {
        place(water, cell, x, top + waterHeight / 2, z, .985, waterHeight, .985, waterColors[depthBand(depth[cell])]);
      }

      if (roadAt.has(cell)) {
        const horizontal = (col > 0 && roadAt.has(cell - 1)) || (col + 1 < size && roadAt.has(cell + 1));
        const vertical = roadAt.has(cell - size) || roadAt.has(cell + size);
        const crossing = horizontal === vertical;
        place(road, cell, x, top + waterHeight + .02, z,
          crossing || horizontal ? 1 : .33, .035, crossing || vertical ? 1 : .33,
          waterHeight > 0 ? '#446f82' : roadColor);
      }
      const building = buildingAt.get(cell);
      const structureHeight = building ? (building.type === 'business' ? .95 : .72) : 0;
      if (building) {
        const tint = buildingColors[building.type] ?? buildingColors.service;
        place(buildings, cell, x, top + structureHeight / 2, z, .65, structureHeight, .65, tint);
        if (waterHeight >= structureHeight) {
          place(buildings, cell, x, top + waterHeight + .025, z, .32, .04, .32, tint);
        }
      }
      if (selected === cell) marker.position.set(x, top + Math.max(waterHeight, structureHeight) + .095, z);
    }

    for (const { mesh, count } of layers) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (width !== nextWidth || height !== nextHeight) {
      width = nextWidth;
      height = nextHeight;
      renderer.setSize(width, height, false);
    }
    const aspect = width / height;
    const halfHeight = size * Math.max(.59, .76 / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.position.set(size * .92, size * 1.3 + 2, size * 1.03);
    camera.lookAt(0, 2, 0);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  return {
    render,
    pick(relativeX, relativeY) {
      pointer.set(relativeX * 2 - 1, 1 - relativeY * 2);
      pickRay.setFromCamera(pointer, camera);
      const hit = pickRay.intersectObjects(layers.map(({ mesh }) => mesh), false)[0];
      return hit ? layers.find(({ mesh }) => mesh === hit.object)?.cells[hit.instanceId] : null;
    },
    destroy() {
      clearLayers();
      box.dispose();
      surface.dispose();
      waterMaterial.dispose();
      markerMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

let fieldId = 0;
function coordinateField(label) {
  const wrapper = element('div', null, 'storm-scene__coordinate');
  const caption = element('label', label);
  const input = element('input');
  input.type = 'number';
  input.id = `storm-coordinate-${++fieldId}`;
  input.min = input.step = '1';
  caption.htmlFor = input.id;
  wrapper.append(caption, input);
  return { wrapper, input };
}

function mapLegend() {
  const entries = [
    ['Dry land', dryHigh], ['Water below 0.10 m', waterColors[0]], ['0.10 m to under 0.40 m', waterColors[1]],
    ['0.40 m and above', waterColors[2]], ['Road marker', roadColor], ['Building marker', buildingColors.home],
    ['Selected cell', selectionColor],
  ];
  const legend = element('ul', null, 'storm-scene__legend');
  legend.setAttribute('aria-label', 'Storm map legend');
  for (const [label, color] of entries) {
    const item = element('li', label);
    item.style.setProperty('--storm-swatch', color);
    legend.append(item);
  }
  return legend;
}

export function mountStormScene(host, { onCell }) {
  const panel = element('div', null, 'storm-scene');
  const viewport = element('div', null, 'storm-scene__viewport');
  const canvas3d = element('canvas', null, 'storm-scene__canvas--3d');
  const canvas2d = element('canvas', null, 'storm-scene__canvas--2d');
  for (const canvas of [canvas3d, canvas2d]) canvas.setAttribute('aria-hidden', 'true');
  viewport.append(canvas3d, canvas2d);

  const toolbar = element('div', null, 'storm-scene__toolbar');
  const mode = element('p', '2D map · Loading 3D terrain');
  const toggle = element('button', 'Use 2D view');
  toggle.type = 'button';
  toggle.hidden = true;
  toolbar.append(mode, toggle);

  const row = coordinateField('Grid row');
  const column = coordinateField('Grid column');
  const select = element('button', 'Select cell');
  select.type = 'button';
  const controls = element('fieldset', null, 'storm-scene__controls');
  controls.disabled = true;
  controls.append(element('legend', 'Cell selection'), row.wrapper, column.wrapper, select);

  const selection = element('p', 'No cell selected.', 'storm-scene__selection');
  selection.setAttribute('role', 'status');
  const reading = element('p', null, 'storm-scene__reading');
  panel.append(toolbar, viewport, mapLegend(), controls, selection, reading);
  host.append(panel);

  let terrainRenderer;
  let frame;
  let show2d = true;
  let destroyed = false;
  canvas3d.hidden = true;

  function draw() {
    if (!frame || destroyed) return;
    if (show2d) {
      drawMap(canvas2d, frame);
      return;
    }
    if (!viewport.clientWidth || !viewport.clientHeight) return;
    try {
      terrainRenderer.render(frame, viewport.clientWidth, viewport.clientHeight);
    } catch {
      fallback();
    }
  }

  function updateMode() {
    canvas3d.hidden = show2d;
    canvas2d.hidden = !show2d;
    toggle.hidden = !terrainRenderer;
    toggle.textContent = show2d ? 'Use 3D view' : 'Use 2D view';
    mode.textContent = show2d ? 'Top-down grid' : '3D terrain · Elevation and water height exaggerated';
    draw();
  }

  function fallback() {
    if (terrainRenderer) {
      const failedRenderer = terrainRenderer;
      terrainRenderer = null;
      failedRenderer.destroy();
    }
    show2d = true;
    updateMode();
    mode.textContent = 'Top-down grid · 3D unavailable';
  }

  function setSelected(index) {
    if (frame && validCell(index, frame.size)) onCell(index);
  }

  function selectCoordinates() {
    if (!frame || !row.input.reportValidity() || !column.input.reportValidity()) return;
    setSelected((row.input.valueAsNumber - 1) * frame.size + column.input.valueAsNumber - 1);
  }

  function relativePoint(event) {
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    return [(event.clientX - left) / width, (event.clientY - top) / height];
  }

  canvas3d.addEventListener('click', event => setSelected(terrainRenderer?.pick(...relativePoint(event))));
  canvas2d.addEventListener('click', event => {
    if (!frame) return;
    const [x, y] = relativePoint(event);
    if (x >= 0 && y >= 0 && x < 1 && y < 1) {
      setSelected(Math.floor(y * frame.size) * frame.size + Math.floor(x * frame.size));
    }
  });
  canvas3d.addEventListener('webglcontextlost', fallback);
  toggle.addEventListener('click', () => {
    show2d = !show2d;
    updateMode();
  });
  select.addEventListener('click', selectCoordinates);
  for (const { input } of [row, column]) {
    input.required = true;
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        selectCoordinates();
      }
    });
  }
  const observer = new ResizeObserver(draw);
  observer.observe(viewport);

  // The timeline drives frames. The view never starts its own animation.
  import('/vendor/three/three.module.js').then(THREE => {
    if (destroyed) return;
    terrainRenderer = createTerrainRenderer(THREE, canvas3d);
    show2d = false;
    updateMode();
  }).catch(() => {
    if (!destroyed) fallback();
  });

  return {
    render(input) {
      if (destroyed) return;
      const previous = frame;
      frame = prepareFrame(input);
      const { size, selected, terrain, depth, buildingAt, roadAt } = frame;
      controls.disabled = false;
      row.input.max = column.input.max = String(size);
      if (!previous || previous.selected !== selected || previous.size !== size) {
        const r = selected === null ? 1 : Math.floor(selected / size) + 1;
        const c = selected === null ? 1 : selected % size + 1;
        row.input.value = String(r);
        column.input.value = String(c);
        selection.textContent = selected === null ? 'No cell selected.' : `Row ${r}, column ${c} selected.`;
      }
      const details = selected === null ? [] : [
        `Water depth ${depth[selected].toFixed(3)} m`,
        `Elevation ${terrain[selected].toFixed(3)} m`,
        buildingAt.get(selected)?.name, roadAt.get(selected)?.name,
      ];
      reading.textContent = details.filter(Boolean).join(' · ');
      draw();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      canvas3d.removeEventListener('webglcontextlost', fallback);
      terrainRenderer?.destroy();
      panel.remove();
    },
  };
}
