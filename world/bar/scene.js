import * as THREE from 'three';
import { SoftwareRenderer } from './software-renderer.js';

/** Procedural stage only: all decisions and purchases belong to the bar model. */
export function createBarScene(container, {
  patrons = [], groups = [], onSelectPatron = () => {}, onSelectGroup = () => {},
  onBartender = () => {}, reducedMotion = false,
} = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#111a24');
  scene.fog = new THREE.Fog('#111a24', 28, 65);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
  catch { renderer = new SoftwareRenderer(); }
  const software = renderer.isSoftwareRenderer === true;
  renderer.setPixelRatio(software ? 1 : Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.dataset.renderer = software ? 'canvas2d' : 'webgl';
  canvas.setAttribute('aria-label', 'The Social Bear: click a guest, a table, or the bartender. The guest list also works with a keyboard.');
  canvas.setAttribute('role', 'img');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;';
  container.appendChild(canvas);

  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  const target = new THREE.Vector3(0, .5, -.1);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const hitTargets = [], people = new Map(), groupMarkers = new Map();
  let disposed = false, frame = 0, selectedId = null, hoveredId = null, lastTime = 0;
  const clockStart = performance.now();
  let mood = 'open';

  function mat(color, extra = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: .72, ...extra });
    materials.add(m); return m;
  }
  const palette = {
    brass: mat('#bc975d', { metalness: .72, roughness: .33 }),
    darkWood: mat('#3e2928'), wood: mat('#76503b'), floor: mat('#70523f'),
    teal: mat('#1d5a55'), wine: mat('#783846'), wall: mat('#173b40'),
    cream: mat('#f4dfbd'), dark: mat('#18202d'), black: mat('#10171f'),
    pink: mat('#ff8aab', { emissive: '#e45a8d', emissiveIntensity: 1.8 }),
    cyan: mat('#72e4d4', { emissive: '#39b9bd', emissiveIntensity: 1.4 }),
    amber: mat('#ffe0a1', { emissive: '#f3bb6a', emissiveIntensity: 1.4 }),
    leaf: mat('#39765a'), leafDark: mat('#214c3e'), glass: mat('#77a391', { metalness: .15, roughness: .2 }),
  };
  function geometry(g) { geometries.add(g); return g; }
  function mesh(parent, g, m, x = 0, y = 0, z = 0, shadow = true) {
    const o = new THREE.Mesh(g, m); o.position.set(x, y, z);
    o.castShadow = shadow; o.receiveShadow = shadow; parent.add(o); return o;
  }
  const boxGeometry = geometry(new THREE.BoxGeometry(1, 1, 1));
  const softwareBoxes = new Map();
  const sphereGeometry = geometry(new THREE.SphereGeometry(1, software ? 8 : 16, software ? 6 : 12));
  const cylinderGeometry = geometry(new THREE.CylinderGeometry(1, 1, 1, software ? 10 : 24));
  function box(parent, x, y, z, w, h, d, material, shadow = true) {
    let shape = boxGeometry;
    if (software && Math.max(w, h, d) > 1) {
      // A painter renderer cannot correctly order a room-sized triangle against
      // a person. Divide only large surfaces into ~1-unit cells; their projected
      // faces remain cached until the camera changes. Small props stay cheap.
      const segments = [w, h, d].map(size => Math.max(1, Math.ceil(size)));
      const key = segments.join(':');
      shape = softwareBoxes.get(key);
      if (!shape) {
        shape = geometry(new THREE.BoxGeometry(1, 1, 1, ...segments));
        softwareBoxes.set(key, shape);
      }
    }
    const o = mesh(parent, shape, material, x, y, z, shadow); o.scale.set(w, h, d); return o;
  }
  function orb(parent, x, y, z, r, material, scale = [1, 1, 1]) {
    const o = mesh(parent, sphereGeometry, material, x, y, z); o.scale.set(r * scale[0], r * scale[1], r * scale[2]); return o;
  }
  function cylinder(parent, x, y, z, r, h, material) {
    const o = mesh(parent, cylinderGeometry, material, x, y, z); o.scale.set(r, h, r); return o;
  }
  function textTexture(text, { color = '#ffe0aa', background = null, size = 64, width = 1024, height = 160, tracking = false } = {}) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, width, height); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    ctx.font = `600 ${size}px ${tracking ? 'monospace' : 'sans-serif'}`;
    ctx.shadowColor = color; ctx.shadowBlur = background ? 0 : 10;
    ctx.fillText(text, width / 2, height / 2, width - 40);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture); return texture;
  }
  function textPlane(text, x, y, z, width, height, options = {}) {
    const m = new THREE.MeshBasicMaterial({ map: textTexture(text, options), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    materials.add(m);
    return mesh(scene, geometry(new THREE.PlaneGeometry(width, height, software ? Math.ceil(width) : 1, software ? Math.ceil(height) : 1)), m, x, y, z, false);
  }
  function addPick(object, type, id) {
    object.traverse(child => { if (child.isMesh) { child.userData.pick = { type, id }; hitTargets.push(child); } });
  }

  scene.add(new THREE.HemisphereLight('#bcd4ec', '#66423c', 2));
  const key = new THREE.DirectionalLight('#ffe5c2', 2.8);
  key.position.set(3, 12, 8); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: .5, far: 35 });
  key.shadow.bias = -.001; key.shadow.normalBias = .025; scene.add(key);
  const tealLight = new THREE.PointLight('#45cfca', 28, 15, 2); tealLight.position.set(-7, 5, -4); scene.add(tealLight);
  const pinkLight = new THREE.PointLight('#f370ad', 24, 13, 2); pinkLight.position.set(6, 4, -4); scene.add(pinkLight);
  const warm = new THREE.PointLight('#ffc47a', 38, 16, 2); warm.position.set(0, 4.4, -2.3); scene.add(warm);

  // Open-front dollhouse: raised walnut platform, planks and a pair of cutaway walls.
  box(scene, 0, -.22, 0, 16.2, .45, 12.3, palette.darkWood).userData.softwareLayer = -40;
  box(scene, 0, -.02, 0, 16, .08, 12, palette.floor).userData.softwareLayer = -39;
  const floorColors = ['#674c3e', '#765642', '#805e47', '#70513e', '#6c4e40'].map(c => mat(c));
  for (let row = 0; row < 24; row++) for (let col = 0; col < 5; col++) {
    const x = -6.4 + col * 3.2 + (row % 2 ? .45 : 0);
    const width = Math.min(3.15, 8 - x + 1.58);
    box(scene, x - (3.15 - width) / 2, .04, -5.75 + row * .5, width, .055, .475, floorColors[(row * 3 + col * 7) % floorColors.length]).userData.softwareLayer = -38;
  }
  box(scene, 0, 2.4, -6, 16.2, 4.8, .25, palette.wall);
  box(scene, -8, 1.65, -.3, .25, 3.3, 11.6, palette.wall);
  box(scene, 0, 1.1, -5.83, 15.8, 2.1, .12, palette.darkWood);
  box(scene, 0, 2.13, -5.68, 16, .08, .09, palette.brass);
  for (let x = -7.5; x < 8; x += 1.1) box(scene, x, 1.05, -5.7, .045, 1.95, .08, palette.brass);
  box(scene, -7.83, 1.05, -.35, .09, 2.05, 11.2, palette.darkWood);
  box(scene, -7.71, 2.12, -.35, .08, .07, 11.2, palette.brass);
  box(scene, 0, 4.78, -5.84, 16, .06, .08, palette.pink, false);
  box(scene, -7.8, 3.28, -.3, .06, .05, 11.2, palette.cyan, false);

  // Back bar and bottles. Bottle colors are intentionally opaque for low-cost rendering.
  box(scene, -.5, .88, -3.6, 11.3, 1.75, .95, palette.darkWood);
  box(scene, -.5, 1.81, -3.6, 11.7, .19, 1.25, palette.wood);
  box(scene, -.5, 1.9, -3.6, 11.8, .035, 1.29, palette.brass);
  box(scene, -.5, .33, -2.96, 10.7, .045, .055, palette.brass);
  const panels = 12;
  for (let i = 0; i < panels; i++) box(scene, -5.65 + i * .94, .94, -3.1, .035, 1.5, .04, palette.brass);
  const bottleMats = ['#2d8975', '#a86538', '#b76a76', '#6d83a3', '#dbc085'].map(c => mat(c, { roughness: .23, metalness: .1 }));
  function bottle(parent, x, y, z, i = 0) {
    const h = .3 + (i % 3) * .055;
    cylinder(parent, x, y + h / 2, z, .085, h, bottleMats[i % bottleMats.length]);
    cylinder(parent, x, y + h + .07, z, .038, .14, bottleMats[i % bottleMats.length]);
    cylinder(parent, x, y + h + .145, z, .042, .025, palette.brass);
    box(parent, x, y + h * .55, z + .086, .11, .12, .012, palette.cream);
  }
  for (const shelfY of [2.45, 3.4]) {
    for (const side of [-1, 1]) {
      const center = side * 5.55;
      box(scene, center, shelfY, -5.5, 3.9, .12, .55, palette.wood);
      box(scene, center, shelfY + .07, -5.27, 3.95, .04, .045, palette.brass);
      for (let i = 0; i < 10; i++) bottle(scene, center - 1.5 + i * .33, shelfY + .08, -5.48, i + (side < 0 ? 1 : 0));
      box(scene, center, shelfY - .04, -5.4, 3.7, .015, .24, palette.amber, false);
    }
  }
  textPlane('THE SOCIAL BEAR', 0, 3.48, -5.62, 6.9, .95, { color: '#ffb9cd', size: 70, width: 1100 });
  textPlane('GOOD COMPANY · BAD OPENING LINES', 0, 2.75, -5.59, 5.3, .4, { color: '#e9c58e', size: 30, width: 1100, tracking: true });
  // Bear neon medallion.
  const bearOutline = new THREE.Group(); bearOutline.position.set(0, 4.31, -5.62); scene.add(bearOutline);
  const ringGeometry = geometry(new THREE.TorusGeometry(.24, .018, software ? 5 : 7, software ? 20 : 36));
  mesh(bearOutline, ringGeometry, palette.amber);
  for (const side of [-1, 1]) { const ear = mesh(bearOutline, ringGeometry, palette.amber, side * .21, .22, 0); ear.scale.setScalar(.43); }
  for (const side of [-1, 1]) orb(bearOutline, side * .075, .025, .01, .022, palette.amber);
  orb(bearOutline, 0, -.07, .01, .032, palette.amber, [1.3, .8, .6]);

  function glass(parent, x, y, z, color = '#e5a16a', kind = 0) {
    const liquid = mat(color, { roughness: .25, metalness: .15 });
    if (kind % 2) {
      cylinder(parent, x, y + .13, z, .1, .23, liquid);
      cylinder(parent, x, y + .25, z, .105, .025, palette.cream);
      const lime = cylinder(parent, x + .07, y + .27, z, .075, .018, palette.leaf); lime.rotation.z = .8;
    } else {
      cylinder(parent, x, y + .02, z, .11, .025, palette.brass);
      cylinder(parent, x, y + .09, z, .018, .14, palette.brass);
      const bowl = mesh(parent, geometry(new THREE.ConeGeometry(.13, .19, software ? 8 : 16)), liquid, x, y + .2, z); bowl.rotation.x = Math.PI;
    }
  }
  for (let i = 0; i < 6; i++) glass(scene, -4.9 + i * 1.8, 1.93, -3.45, ['#e0a069', '#c57587', '#84b6a8'][i % 3], i);
  const till = box(scene, 3.1, 2.07, -3.72, .55, .3, .4, palette.dark); till.rotation.x = -.15;
  box(scene, 3.1, 2.24, -3.55, .44, .17, .025, palette.cyan, false);
  for (let i = 0; i < 5; i++) {
    const x = -4.5 + i * 2;
    cylinder(scene, x, .08, -2.35, .35, .12, palette.dark);
    cylinder(scene, x, .57, -2.35, .055, 1, palette.brass);
    cylinder(scene, x, 1.13, -2.35, .33, .16, i % 2 ? palette.wine : palette.teal);
    const foot = mesh(scene, geometry(new THREE.TorusGeometry(.21, .025, software ? 4 : 6, software ? 12 : 24)), palette.brass, x, .47, -2.35); foot.rotation.x = Math.PI / 2;
  }

  // Three social corners with generous visual separation for selection.
  const groupPositions = [new THREE.Vector3(-4.5, 0, 1.25), new THREE.Vector3(.2, 0, 2.9), new THREE.Vector3(4.9, 0, .6)];
  const groupAngles = [[.28, 2.8], [.5, -1.0], [.2, -2.7]];
  const markerMaterial = new THREE.MeshBasicMaterial({ color: '#ffd4a3', transparent: true, opacity: .4, depthWrite: false, side: THREE.DoubleSide });
  materials.add(markerMaterial);
  const haloGeometry = geometry(new THREE.RingGeometry(.48, .54, software ? 24 : 40));
  function rug(x, z, color, w = 3.6, d = 3.2) {
    const base = box(scene, x, .09, z, w, .035, d, mat(color)); base.userData.softwareLayer = -37;
    box(scene, x, .113, z - d / 2 + .13, w - .2, .01, .04, palette.brass, false).userData.softwareLayer = -36;
    box(scene, x, .113, z + d / 2 - .13, w - .2, .01, .04, palette.brass, false).userData.softwareLayer = -36;
    return base;
  }
  function table(pos, index, group) {
    const root = new THREE.Group(); root.position.copy(pos); scene.add(root);
    cylinder(root, 0, .19, 0, .48, .12, palette.dark);
    cylinder(root, 0, .72, 0, .075, 1, palette.brass);
    cylinder(root, 0, 1.28, 0, .73, .13, palette.wood);
    cylinder(root, 0, 1.36, 0, .74, .035, palette.brass);
    glass(root, -.3, 1.4, -.1, '#d39d64', index);
    glass(root, .24, 1.4, .18, '#78a995', index + 1);
    cylinder(root, 0, 1.48, -.2, .09, .15, palette.cream);
    orb(root, 0, 1.59, -.2, .045, palette.amber, [.6, 1.35, .6]);
    const candle = new THREE.PointLight('#ffc574', 2.7, 3, 2); candle.position.set(0, 1.7, -.2); root.add(candle);
    addPick(root, 'group', group?.id ?? `group-${index}`);
    const ring = mesh(scene, geometry(new THREE.RingGeometry(1.48, 1.53, software ? 32 : 64)), markerMaterial.clone(), pos.x, .14, pos.z, false);
    materials.add(ring.material); ring.rotation.x = -Math.PI / 2; ring.visible = false;
    groupMarkers.set(group?.id ?? `group-${index}`, ring);
  }
  rug(-4.5, 1.2, '#253f43'); rug(.2, 2.8, '#6e3547'); rug(4.9, .6, '#35443b');
  // Left booth, banquette, small stage and leafy corners.
  box(scene, -6.85, .48, 1.7, 1.2, .7, 4.2, palette.darkWood);
  box(scene, -6.7, .88, 1.7, 1.25, .25, 4.2, palette.teal);
  box(scene, -7.3, 1.33, 1.7, .23, 1.1, 4.3, palette.teal);
  for (let z = -.1; z < 3.7; z += .45) orb(scene, -7.15, 1.5, z, .035, palette.brass);
  box(scene, 6.8, .55, 1.2, 1.35, .8, 3.8, palette.darkWood);
  box(scene, 6.7, .97, 1.2, 1.3, .25, 3.9, palette.wine);
  box(scene, 7.2, 1.38, 1.2, .27, 1.05, 4.1, palette.wine);
  for (let z = -.3; z < 3; z += .45) orb(scene, 7.04, 1.5, z, .035, palette.brass);
  function plant(x, z, scale = 1) {
    cylinder(scene, x, .32, z, .32 * scale, .6, palette.darkWood);
    cylinder(scene, x, .64, z, .34 * scale, .05, palette.brass);
    for (let j = 0; j < 9; j++) {
      const a = j * 2.4, h = 1 + (j % 3) * .35;
      const leaf = orb(scene, x + Math.sin(a) * .28 * scale, h * scale, z + Math.cos(a) * .28 * scale, .28 * scale, j % 2 ? palette.leaf : palette.leafDark, [.55, 1.85, .4]);
      leaf.rotation.z = Math.sin(a) * .55; leaf.rotation.y = a;
    }
  }
  plant(-6.9, -4.5, 1.2); plant(7.1, -4.7, 1.3); plant(-7.1, 4.8, 1); plant(7.2, 4.7, 1.05);
  // Jukebox: a little comic centerpiece in the right back corner.
  const jukebox = new THREE.Group(); jukebox.position.set(6.8, 0, -2.7); scene.add(jukebox);
  box(jukebox, 0, .88, 0, 1.15, 1.65, .65, palette.darkWood);
  const arch = mesh(jukebox, geometry(new THREE.TorusGeometry(.46, .055, software ? 5 : 8, software ? 24 : 40, Math.PI)), palette.pink, 0, 1.65, .37); arch.rotation.z = 0;
  box(jukebox, -.46, .9, .37, .08, 1.5, .06, palette.pink, false);
  box(jukebox, .46, .9, .37, .08, 1.5, .06, palette.pink, false);
  box(jukebox, 0, 1.34, .36, .7, .5, .035, palette.cyan, false);
  for (let j = 0; j < 7; j++) box(jukebox, 0, .35 + j * .1, .36, .65, .035, .06, palette.brass);

  // Portraits and pendant lamps keep the room detailed without external textures.
  for (let i = 0; i < 3; i++) {
    const portrait = new THREE.Group(); portrait.position.set(-7.69, 2.5, -2.9 + i * 2.5); portrait.rotation.y = Math.PI / 2; scene.add(portrait);
    box(portrait, 0, 0, 0, 1.35, .9, .07, palette.brass);
    box(portrait, 0, 0, .045, 1.22, .76, .035, i % 2 ? palette.wine : palette.teal);
    orb(portrait, 0, .07, .08, .21, palette.cream, [1, 1.25, .1]);
    box(portrait, 0, -.2, .09, .5, .28, .02, palette.darkWood);
    for (const side of [-1, 1]) orb(portrait, side * .15, .24, .08, .085, palette.cream, [1, 1, .1]);
  }
  for (const x of [-3.6, 2.9]) {
    cylinder(scene, x, 4.2, -3, .018, 1.1, palette.brass);
    const shade = mesh(scene, geometry(new THREE.ConeGeometry(.5, .32, software ? 12 : 32, 1, true)), palette.brass, x, 3.65, -3); shade.rotation.x = Math.PI;
    cylinder(scene, x, 3.52, -3, .35, .035, palette.amber);
  }

  const skinColors = ['#c28a63', '#e6b58c', '#966044', '#d79b77', '#6e4939', '#cda288'];
  const hairColors = ['#302521', '#4c3028', '#211f2c', '#9e653b', '#171a22', '#3c2729'];
  function person(patron, index, position, yaw = 0, bartender = false) {
    const root = new THREE.Group(); root.position.copy(position); root.rotation.y = yaw; scene.add(root);
    const body = new THREE.Group(); root.add(body);
    const skin = mat(skinColors[index % skinColors.length]), hair = mat(hairColors[index % hairColors.length]);
    const clothes = mat(patron.color || ['#d38d45', '#597f9e', '#ac506d', '#508c7e', '#d0b38a', '#7d76a4'][index % 6]);
    const trousers = mat(index % 2 ? '#253443' : '#393143');
    const woman = String(patron.gender).toLowerCase() === 'woman' || String(patron.gender).toLowerCase() === 'female';
    const height = 1.04 + (index % 3) * .035;
    body.scale.setScalar(height);
    // Adult proportions: small head, long legs, tailored outfits.
    box(body, -.12, .43, 0, .18, .72, .22, trousers); box(body, .12, .43, 0, .18, .72, .22, trousers);
    box(body, -.12, .09, .065, .21, .12, .37, palette.dark); box(body, .12, .09, .065, .21, .12, .37, palette.dark);
    box(body, 0, 1.04, 0, .49, .6, .27, clothes);
    box(body, 0, .78, .01, .4, .18, .25, trousers);
    box(body, 0, .83, .15, .42, .035, .035, palette.brass);
    if (bartender) { box(body, 0, 1.03, .15, .33, .5, .035, palette.teal); box(body, 0, 1.3, .17, .14, .06, .035, palette.wine); }
    else if (index % 2) { box(body, 0, 1.1, .145, .1, .47, .035, palette.cream); box(body, 0, 1.31, .18, .05, .17, .025, palette.brass); }
    else { const necklace = mesh(body, geometry(new THREE.TorusGeometry(.12, .012, software ? 4 : 6, software ? 12 : 20, Math.PI)), palette.brass, 0, 1.31, .17); necklace.rotation.z = Math.PI; }
    cylinder(body, 0, 1.4, 0, .08, .18, skin);
    const head = new THREE.Group(); head.position.set(0, 1.62, 0); body.add(head);
    orb(head, 0, 0, 0, .205, skin, [.86, 1.12, .88]);
    orb(head, 0, .13, -.015, .207, hair, [.91, .55, .9]);
    if (woman) {
      orb(head, 0, .02, -.135, .22, hair, [1.04, 1.45, .62]);
      if (index % 2 === 0) orb(head, .15, .17, -.07, .13, hair, [1, 1, .85]);
      else { box(head, -.19, -.06, 0, .055, .34, .17, hair); box(head, .19, -.06, 0, .055, .34, .17, hair); }
      for (const side of [-1, 1]) orb(head, side * .18, -.035, .055, .025, palette.brass);
    } else if (index % 3 === 0) box(head, 0, -.13, .105, .24, .11, .09, hair);
    // Eyes, brows, nose and an understated smile.
    for (const side of [-1, 1]) {
      orb(head, side * .068, .015, .166, .026, palette.cream, [1, .8, .5]);
      orb(head, side * .068, .012, .18, .013, palette.dark, [1, 1, .5]);
      const brow = box(head, side * .067, .067, .175, .065, .013, .013, hair, false); brow.rotation.z = side * -.1;
    }
    orb(head, 0, -.033, .175, .04, skin, [.75, 1, 1.3]);
    const smile = mesh(head, geometry(new THREE.TorusGeometry(.05, .009, software ? 3 : 6, software ? 10 : 16, Math.PI)), palette.dark, 0, -.07, .173, false); smile.rotation.z = Math.PI;
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * .31, 1.3, 0); body.add(arm);
      box(arm, 0, -.12, 0, .16, .29, .19, clothes);
      cylinder(arm, 0, -.37, 0, .055, .25, skin);
      orb(arm, 0, -.53, 0, .075, skin, [.9, 1.1, .8]);
      arm.rotation.z = side * .15; arms.push(arm);
    }
    const halo = mesh(root, haloGeometry, markerMaterial.clone(), 0, .15, 0, false);
    materials.add(halo.material); halo.rotation.x = -Math.PI / 2; halo.visible = false;
    const tagMat = new THREE.SpriteMaterial({ map: textTexture(patron.name || 'Bartender', { size: 45, width: 512, height: 112, color: '#fff0d8', background: '#1b2d37' }), transparent: true, depthTest: false });
    materials.add(tagMat);
    const label = new THREE.Sprite(tagMat); label.position.set(0, 2.25, 0); label.scale.set(1.55, .34, 1); label.visible = bartender; root.add(label);
    addPick(body, bartender ? 'bartender' : 'patron', patron.id);
    const entry = { root, body, head, arms, halo, label, phase: index * 1.7, reactionUntil: 0, reaction: '', bartender, baseY: position.y };
    people.set(patron.id, entry); return entry;
  }
  groups.slice(0, 3).forEach((group, i) => table(groupPositions[i], i, group));
  const placed = new Set();
  groups.slice(0, 3).forEach((group, gi) => {
    const center = groupPositions[gi];
    const ids = group.memberIds ?? [];
    ids.forEach((id, mi) => {
      const patron = patrons.find(p => p.id === id); if (!patron || placed.has(id)) return;
      const index = patrons.indexOf(patron), side = mi % 2 ? 1 : -1;
      const position = new THREE.Vector3(center.x + side * 1.05, .12, center.z + (mi % 2 ? .5 : -.3));
      person(patron, index, position, groupAngles[gi][mi % 2]); placed.add(id);
    });
  });
  patrons.filter(p => !placed.has(p.id)).forEach((p, i) => person(p, patrons.indexOf(p), new THREE.Vector3(-5 + i * 1.6, .1, 1), -.2));
  person({ id: 'bartender', name: 'Jules · bartender', color: '#efe0c5', gender: 'man' }, 4, new THREE.Vector3(-1.5, .12, -4.6), 0, true);

  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(hitTargets, false)[0]?.object.userData.pick ?? null;
  }
  function updateSelection() {
    for (const [id, p] of people) {
      const active = id === selectedId || id === hoveredId;
      p.halo.visible = active; p.halo.material.opacity = id === selectedId ? .9 : .5;
      p.label.visible = active || p.bartender;
    }
    for (const [id, ring] of groupMarkers) { ring.visible = id === selectedId || id === hoveredId; ring.material.opacity = id === selectedId ? .65 : .3; }
  }
  function onMove(event) { const hit = pick(event); hoveredId = hit?.id ?? null; canvas.style.cursor = hit ? 'pointer' : 'default'; updateSelection(); }
  function onLeave() { hoveredId = null; canvas.style.cursor = 'default'; updateSelection(); }
  function onClick(event) {
    const hit = pick(event); if (!hit) return;
    if (hit.type === 'patron') onSelectPatron(hit.id);
    else if (hit.type === 'group') onSelectGroup(hit.id);
    else onBartender();
  }
  canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerleave', onLeave); canvas.addEventListener('click', onClick);
  function resize() {
    if (disposed) return;
    const rect = container.getBoundingClientRect(), width = Math.max(1, rect.width), height = Math.max(1, rect.height);
    renderer.setSize(width, height, false); camera.aspect = width / height;
    const aspect = width / height;
    const distanceScale = aspect < 1.15 ? 1.15 / aspect : 1;
    camera.position.set(13.3 * distanceScale, 13.5 * distanceScale, 19 * distanceScale);
    camera.lookAt(target); camera.updateProjectionMatrix(); renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  function draw(now) {
    if (disposed) return;
    frame = requestAnimationFrame(draw);
    if (document.hidden || now - lastTime < (reducedMotion ? 110 : software ? 84 : 28)) return;
    lastTime = now;
    const t = (now - clockStart) / 1000;
    for (const p of people.values()) {
      const reaction = now < p.reactionUntil, laugh = reaction && ['great', 'good', 'laugh', 'positive', 'accepted'].includes(p.reaction);
      const miss = reaction && !laugh;
      p.body.position.y = reducedMotion ? 0 : Math.sin(t * 1.7 + p.phase) * .013;
      p.body.rotation.z = reducedMotion ? 0 : Math.sin(t * .7 + p.phase) * .025;
      p.head.rotation.y = reducedMotion ? 0 : Math.sin(t * .47 + p.phase) * .13;
      p.head.rotation.z = miss ? -.14 : 0;
      p.body.rotation.x = laugh && !reducedMotion ? Math.sin(t * 10) * .055 - .06 : 0;
      p.arms[0].rotation.x = laugh ? -.8 : -.05;
      p.arms[1].rotation.x = reaction ? -.5 : reducedMotion ? 0 : Math.sin(t * .8 + p.phase) * .08;
      if (p.bartender) p.arms[0].rotation.x = -.55;
    }
    pinkLight.intensity = mood === 'closed' ? 12 : 24;
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(draw);
  return {
    select(id) { selectedId = id; updateSelection(); },
    react(ids, kind = 'good') { for (const id of Array.isArray(ids) ? ids : [ids]) { const p = people.get(id); if (p) { p.reaction = kind; p.reactionUntil = performance.now() + 2300; } } },
    setMood(next) { mood = next; },
    dispose() {
      if (disposed) return; disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('click', onClick);
      for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); for (const t of textures) t.dispose();
      renderer.dispose(); canvas.remove();
    },
  };
}
