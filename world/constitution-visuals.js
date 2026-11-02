const DRAINAGE_IDS = new Set(["f_drainage"]);
const TRANSIT_IDS = new Set(["t_brt", "t_bus"]);
const HOUSING_IDS = new Set(["h_lots"]);

export function normalizeProposalIds(value) {
  if (Array.isArray(value)) return [...new Set(value.map((id) => String(id || "").trim()).filter(Boolean))];
  return [...new Set(String(value || "").split(",").map((id) => id.trim()).filter(Boolean))];
}

function townBounds(town) {
  const points = [];
  for (const building of town?.buildings || []) {
    if (Array.isArray(building?.center) && building.center.length >= 2) points.push(building.center);
    for (const point of building?.poly || []) if (Array.isArray(point) && point.length >= 2) points.push(point);
  }
  for (const road of town?.roads || []) for (const point of road?.pts || []) if (Array.isArray(point) && point.length >= 2) points.push(point);
  if (!points.length) return { minX: -220, maxX: 220, minZ: -220, maxZ: 220, width: 440, depth: 440, centerX: 0, centerZ: 0 };
  const xs = points.map((p) => Number(p[0])).filter(Number.isFinite);
  const zs = points.map((p) => Number(p[1])).filter(Number.isFinite);
  if (!xs.length || !zs.length) return { minX: -220, maxX: 220, minZ: -220, maxZ: 220, width: 440, depth: 440, centerX: 0, centerZ: 0 };
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const width = Math.max(120, maxX - minX), depth = Math.max(120, maxZ - minZ);
  return { minX, maxX, minZ, maxZ, width, depth, centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2 };
}

function hasAny(ids, set) {
  return ids.some((id) => set.has(id));
}

export function planConstitutionVisuals({ town, proposalIds = [], focusHint = "" } = {}) {
  const ids = normalizeProposalIds(proposalIds);
  const bounds = townBounds(town);
  const drainage = hasAny(ids, DRAINAGE_IDS);
  const transit = hasAny(ids, TRANSIT_IDS);
  const housing = hasAny(ids, HOUSING_IDS);
  let focusKind = String(focusHint || "").toLowerCase();
  if (!["drainage", "transit", "housing", "center"].includes(focusKind)) {
    focusKind = drainage ? "drainage" : transit ? "transit" : housing ? "housing" : "center";
  }

  const drainageZ = bounds.centerZ + bounds.depth * 0.17;
  const transitZ = bounds.centerZ - bounds.depth * 0.06;
  const housingX = bounds.centerX + bounds.width * 0.14;
  const focus = focusKind === "drainage"
    ? { x: bounds.centerX, z: drainageZ }
    : focusKind === "transit"
      ? { x: bounds.centerX, z: transitZ }
      : focusKind === "housing"
        ? { x: housingX, z: bounds.centerZ }
        : { x: bounds.centerX, z: bounds.centerZ };

  return {
    proposalIds: ids,
    bounds,
    focusKind,
    focus,
    features: {
      drainage,
      transit,
      housing,
    },
  };
}

function addDrainage({ THREE, group, layout }) {
  const { bounds } = layout;
  const water = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.48, metalness: 0.04, transparent: true, opacity: 0.92 });
  const trench = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.92, metalness: 0.0 });
  const berm = new THREE.MeshStandardMaterial({ color: 0x6b7f52, roughness: 1.0 });
  const z0 = layout.focus.z;
  const pts = [
    new THREE.Vector3(bounds.minX + bounds.width * 0.08, 0.35, z0 - bounds.depth * 0.04),
    new THREE.Vector3(bounds.minX + bounds.width * 0.28, 0.25, z0 + bounds.depth * 0.025),
    new THREE.Vector3(bounds.centerX, 0.2, z0 - bounds.depth * 0.02),
    new THREE.Vector3(bounds.minX + bounds.width * 0.72, 0.18, z0 + bounds.depth * 0.04),
    new THREE.Vector3(bounds.maxX - bounds.width * 0.08, 0.16, z0),
  ];
  const curve = new THREE.CatmullRomCurve3(pts);
  const base = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 3.6, 6, false), trench);
  base.position.y = -0.35;
  base.receiveShadow = true;
  group.add(base);
  const channel = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 1.65, 6, false), water);
  channel.castShadow = false;
  channel.receiveShadow = true;
  channel.userData.constitutionChange = "Accelerated bayou drainage channel";
  group.add(channel);

  const basinPositions = [
    [bounds.minX + bounds.width * 0.23, z0 + bounds.depth * 0.12],
    [bounds.maxX - bounds.width * 0.22, z0 - bounds.depth * 0.12],
  ];
  for (const [x, z] of basinPositions) {
    const radius = Math.max(13, Math.min(28, Math.min(bounds.width, bounds.depth) * 0.055));
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius + 4, radius + 6, 1.5, 24), berm);
    rim.position.set(x, -0.25, z);
    rim.receiveShadow = true;
    group.add(rim);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 2, 0.7, 24), water);
    basin.position.set(x, 0.1, z);
    basin.userData.constitutionChange = "New detention basin";
    group.add(basin);
  }

  const culvertMaterial = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.55, metalness: 0.35 });
  for (const t of [0.2, 0.5, 0.8]) {
    const p = curve.getPoint(t);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 13, 12), culvertMaterial);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(p.x, 0.4, p.z);
    pipe.userData.constitutionChange = "Drainage culvert";
    group.add(pipe);
  }
}

function addTransit({ THREE, group, layout, town }) {
  const roads = (town?.roads || []).filter((road) => Array.isArray(road?.pts) && road.pts.length >= 2);
  const road = roads.sort((a, b) => {
    const len = (r) => r.pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - r.pts[i][0], p[1] - r.pts[i][1]), 0);
    return len(b) - len(a);
  })[0];
  const source = road?.pts?.length
    ? road.pts.map(([x, z]) => new THREE.Vector3(x, 0.55, z))
    : [
        new THREE.Vector3(layout.bounds.minX + 20, 0.55, layout.focus.z),
        new THREE.Vector3(layout.bounds.maxX - 20, 0.55, layout.focus.z),
      ];
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(source),
    new THREE.LineBasicMaterial({ color: 0xf97316 }),
  );
  line.userData.constitutionChange = "Accelerated transit corridor";
  group.add(line);
  const stopMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 });
  for (let i = 1; i <= 4; i++) {
    const idx = Math.round((source.length - 1) * i / 5);
    const p = source[idx] || source[0];
    const stop = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1.4, 12), stopMat);
    stop.position.copy(p);
    stop.position.y = 0.7;
    group.add(stop);
  }
}

function addHousing({ THREE, group, layout }) {
  const { bounds } = layout;
  const mat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.75, transparent: true, opacity: 0.42 });
  const edge = new THREE.LineBasicMaterial({ color: 0x166534 });
  const baseX = layout.focus.x;
  const baseZ = layout.focus.z;
  for (let i = 0; i < 4; i++) {
    const w = 22 + (i % 2) * 8;
    const d = 18 + ((i + 1) % 2) * 7;
    const h = 28 + i * 10;
    const geometry = new THREE.BoxGeometry(w, h, d);
    const tower = new THREE.Mesh(geometry, mat);
    tower.position.set(baseX + (i - 1.5) * 34, h / 2, baseZ + (i % 2 ? 18 : -18));
    tower.userData.constitutionChange = "Potential housing enabled by plan";
    group.add(tower);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edge);
    edges.position.copy(tower.position);
    group.add(edges);
  }
}

export function mountConstitutionVisuals({
  THREE,
  scene,
  camera,
  controls,
  town,
  proposalIds = [],
  focusHint = "",
  showChanges = true,
} = {}) {
  if (!THREE || !scene || !camera || !controls) return null;
  const layout = planConstitutionVisuals({ town, proposalIds, focusHint });
  const group = new THREE.Group();
  group.name = "constitution-plan-changes";

  if (showChanges && layout.features.drainage) addDrainage({ THREE, group, layout });
  if (showChanges && layout.features.transit) addTransit({ THREE, group, layout, town });
  if (showChanges && layout.features.housing) addHousing({ THREE, group, layout });

  if (group.children.length) scene.add(group);

  const span = Math.max(180, Math.min(700, Math.max(layout.bounds.width, layout.bounds.depth)));
  controls.target.set(layout.focus.x, 0, layout.focus.z);
  camera.position.set(layout.focus.x + span * 0.34, Math.max(88, span * 0.24), layout.focus.z + span * 0.38);
  controls.update();

  const changes = [];
  if (layout.features.drainage) changes.push("drainage channels and detention basins");
  if (layout.features.transit) changes.push("transit corridor");
  if (layout.features.housing) changes.push("housing build-out envelope");

  return {
    layout,
    group,
    changes,
    dispose() {
      scene.remove(group);
      group.traverse((obj) => {
        obj.geometry?.dispose?.();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
        else obj.material?.dispose?.();
      });
    },
  };
}
