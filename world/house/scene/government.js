/** Cosmetic props and reactions for recorded appliance-government episodes.
 * No timers, random outcomes, needs, inventory or simulation writes live here. */
const EPISODES = new Set(['fridge-strike', 'sofa-election', 'porcelain-tribunal']);
const text = (value, limit = 240) => typeof value === 'string' ? value.slice(0, limit) : '';

export function governmentSceneRecords(home) {
  const source = home?.systems?.government ?? {};
  const souvenirs = (Array.isArray(source.souvenirs) ? source.souvenirs : [])
    .filter(row => row && typeof row.id === 'string' && typeof row.objectId === 'string' && EPISODES.has(row.episodeId))
    .slice(-3).map(row => ({...row, title: text(row.title, 80)}));
  const events = (Array.isArray(source.events) ? source.events : [])
    .filter(row => row && typeof row.id === 'string' && Number.isFinite(row.minute) && EPISODES.has(row.episodeId) && typeof row.quote === 'string')
    .slice(-32);
  const active = source.active && EPISODES.has(source.active.episodeId) && typeof source.active.objectId === 'string'
    ? source.active : null;
  return {souvenirs, events, active};
}

/** The performer faces the actual appliance; the renderer owns the cosmetic
 * walk to this destination. A saved indoor route keeps its authoritative endpoint. */
export function governmentPerformanceTarget(person, objects, navigation) {
  const action = person?.activeAction, interaction = person?.interaction;
  if (action?.type !== 'governmentPerformance' || ['completed', 'cancelled', 'interrupted'].includes(action.status)
    || interaction?.pose !== 'talk' || person.atHome === false) return null;
  const object = objects.get(String(interaction.objectId));
  if (!object || !['stove', 'fridge', 'couch', 'toilet'].includes(object.record?.type)
    || !Number.isFinite(object.x) || !Number.isFinite(object.z)) return null;
  const angle = object.rotation ?? 0;
  const offset = (object.record.footprint?.depth ?? 1) * (object.scale ?? 1) / 2 + .45;
  const trip = navigation?.trips?.[String(person.id ?? person.personId)];
  const endpoint = trip?.actionId === action.id ? trip.points?.at(-1) : null;
  const routed = Number.isFinite(endpoint?.x) && Number.isFinite(endpoint?.z);
  const x = routed ? endpoint.x : object.x + Math.sin(angle) * offset;
  const z = routed ? endpoint.z : object.z + Math.cos(angle) * offset;
  const heading = Math.hypot(object.x - x, object.z - z) > .01
    ? Math.atan2(object.x - x, object.z - z) : angle + Math.PI;
  return {x, z, heading, objectId: object.record.id};
}

/** A restored receipt is not a new punchline. Retain only a bounded seen set. */
export function createGovernmentEventTracker() {
  let identity = null, initialized = false, lastMinute = null;
  const seen = new Set();
  return {
    observe(householdId, events = [], minute) {
      const restoredEarlier = Number.isFinite(minute) && Number.isFinite(lastMinute) && minute < lastMinute;
      if (Number.isFinite(minute)) lastMinute = minute;
      if (!initialized || identity !== householdId || restoredEarlier) {
        initialized = true;
        identity = householdId;
        seen.clear();
        for (const event of events) seen.add(event.id);
        return [];
      }
      const fresh = [];
      for (const event of events) {
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        fresh.push(event);
      }
      while (seen.size > 96) seen.delete(seen.values().next().value);
      return fresh.slice(-3);
    },
    clear() { identity = null; initialized = false; lastMinute = null; seen.clear(); },
  };
}

export function createGovernmentScene(THREE, scene, interior, {document: doc, labels, viewport} = {}) {
  const group = new THREE.Group();
  group.name = 'Earned household government souvenirs';
  scene.add(group);
  const geometries = new Set(), materials = new Set(), props = new Map();
  const tracker = createGovernmentEventTracker(), queue = [];
  let beat = null, disposed = false, houseId = null, observedMinute = null;
  const reducedMotion = doc?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const material = color => {
    const m = new THREE.MeshStandardMaterial({color, roughness: .65});
    materials.add(m);
    return m;
  };
  const gold = material('#e9b847'), blue = material('#405d68'), cream = material('#fff2cc');
  const wood = material('#7a4c31'), pink = material('#df7e79'), green = material('#679354');
  function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z);
    object.castShadow = true;
    parent.add(object);
    return object;
  }
  const box = (p, w, h, d, m, x = 0, y = 0, z = 0) => mesh(p, new THREE.BoxGeometry(w, h, d), m, x, y, z);
  const cylinder = (p, r1, r2, h, m, x = 0, y = 0, z = 0) => mesh(p, new THREE.CylinderGeometry(r1, r2, h, 10), m, x, y, z);
  function makeLabel(className) {
    if (!doc || !labels) return null;
    const node = doc.createElement('div');
    node.className = className;
    node.style.cssText = 'position:absolute;transform:translate(-50%,-100%);pointer-events:none;border:1px solid #ac783b;border-radius:9px;background:#fff6d8f5;color:#463621;padding:5px 9px;font:600 11px/1.35 system-ui;text-align:center;max-width:200px;box-shadow:0 3px 12px #3d322326;z-index:15';
    labels.append(node);
    return node;
  }
  const speech = makeLabel('house-government-speech');
  let speechKey = '';
  if (speech) {
    speech.dataset.houseGovernmentSpeech = '';
    speech.style.maxWidth = 'min(310px,72vw)';
    speech.style.padding = '11px 15px';
    speech.style.borderWidth = '2px';
    speech.style.fontSize = '13px';
    speech.style.zIndex = '25';
    speech.setAttribute('role', 'status');
    speech.setAttribute('aria-live', 'polite');
    speech.hidden = true;
  }
  function setSpeech(key, speaker, quote) {
    if (!speech || speechKey === key) return;
    speechKey = key;
    speech.replaceChildren();
    const who = doc.createElement('strong'), line = doc.createElement('span');
    who.style.cssText = 'display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#97602c;margin-bottom:4px';
    line.style.cssText = 'display:block;font-weight:500';
    who.textContent = text(speaker || 'Household business', 70);
    line.textContent = text(quote);
    speech.append(who, line);
  }
  function crown(parent, y = .3) {
    cylinder(parent, .27, .27, .16, gold, 0, y);
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      mesh(parent, new THREE.ConeGeometry(.075, .24, 4), gold, Math.sin(angle) * .23, y + .16, Math.cos(angle) * .23);
    }
    mesh(parent, new THREE.SphereGeometry(.055, 6, 5), pink, 0, y, .275);
  }
  function makeProp(record) {
    const prop = new THREE.Group();
    prop.name = record.title;
    group.add(prop);
    let labelText = record.title;
    box(prop, .78, .07, .5, wood, 0, .035);
    if (record.episodeId === 'fridge-strike') {
      box(prop, .55, .66, .055, cream, 0, .4, -.045);
      if (record.kind === 'fridge-tie') {
        const knot = box(prop, .17, .17, .08, blue, 0, .62, .04);
        knot.rotation.z = Math.PI / 4;
        const shape = new THREE.Shape();
        shape.moveTo(-.065, .52); shape.lineTo(.065, .52); shape.lineTo(.12, .15); shape.lineTo(0, .04); shape.lineTo(-.12, .15); shape.closePath();
        const body = mesh(prop, new THREE.ShapeGeometry(shape), blue, 0, 0, .08);
        body.material.side = THREE.DoubleSide;
      } else {
        for (let i = 0; i < 3; i++) box(prop, .33 - i * .045, .025, .015, blue, 0, .63 - i * .09, 0);
        const seal = cylinder(prop, .1, .1, .025, gold, .12, .24, .015);
        seal.rotation.x = Math.PI / 2;
        const ribbon = box(prop, .07, .16, .015, pink, .12, .13, .01);
        ribbon.rotation.z = -.2;
      }
      labelText ||= 'Certified Adult. Pending appeal.';
    } else if (record.episodeId === 'sofa-election') {
      const plantWins = /plant/.test(record.choiceId ?? '') || /plant/.test(record.kind ?? '');
      crown(prop, plantWins ? .24 : .36);
      const sash = box(prop, .57, .1, .08, blue, 0, .11, .16);
      sash.rotation.z = -.12;
      if (plantWins) {
        // The elected plant already exists in interior.objects: dress its crown,
        // rather than making a second plant that could be mistaken for inventory.
        const ribbon = box(prop, .1, .22, .025, pink, .22, .17, .23);
        ribbon.rotation.z = -.2;
      }
      labelText ||= 'Mayor of the sofa';
    } else {
      cylinder(prop, .22, .22, .08, gold, 0, .12);
      const gavel = new THREE.Group();
      prop.add(gavel);
      gavel.position.set(0, .3, 0);
      gavel.rotation.z = -.5;
      cylinder(gavel, .04, .04, .42, wood, 0, .12);
      const head = cylinder(gavel, .13, .13, .3, wood, 0, .36);
      head.rotation.z = Math.PI / 2;
      const badge = mesh(prop, new THREE.CylinderGeometry(.16, .16, .04, 6), gold, .25, .27, .2);
      badge.rotation.x = Math.PI / 2;
      box(prop, .055, .14, .05, blue, .25, .27, .23);
      mesh(prop, new THREE.SphereGeometry(.035, 6, 5), cream, .25, .37, .24);
      labelText ||= 'Minister of the Interior';
    }
    const label = makeLabel('house-government-souvenir-label');
    if (label) { label.textContent = labelText; label.hidden = true; }
    const pickRecord = {...record, type: 'government-souvenir', name: record.title, text: record.description ?? record.title};
    prop.traverse(node => { if (node.isMesh) node.userData.pick = {kind: 'keepsake', record: pickRecord}; });
    return {group: prop, label, record, pickRecord};
  }
  function disposeProp(entry) {
    entry.label?.remove();
    entry.group.traverse(node => {
      if (node.geometry) { node.geometry.dispose(); geometries.delete(node.geometry); }
    });
    entry.group.removeFromParent();
  }
  const ring = mesh(group, new THREE.RingGeometry(.66, .74, 36), material('#e9b847'));
  ring.rotation.x = -Math.PI / 2;
  ring.material.side = THREE.DoubleSide;
  ring.material.transparent = true;
  ring.material.opacity = .7;
  ring.visible = false;
  const confetti = new THREE.Group();
  group.add(confetti);
  const bits = Array.from({length: 18}, (_, i) => box(confetti, .065, .045, .018, [gold, pink, green, cream][i % 4]));
  confetti.visible = false;
  const accent = new THREE.Group();
  group.add(accent);
  const accentMaterial = material('#71a3b0');
  accentMaterial.side = THREE.DoubleSide;
  accentMaterial.transparent = true;
  const ripples = Array.from({length: 3}, () => mesh(accent, new THREE.RingGeometry(.18, .23, 16), accentMaterial));
  accent.visible = false;
  const bounds = new THREE.Box3(), center = new THREE.Vector3();
  function objectAnchor(id) {
    const object = interior.objects.get(String(id));
    if (!object?.group?.visible) return null;
    object.group.updateWorldMatrix(true, true);
    bounds.setFromObject(object.group);
    if (bounds.isEmpty()) return null;
    bounds.getCenter(center);
    return new THREE.Vector3(center.x, bounds.max.y, center.z);
  }
  function project(node, point, camera, margin = 36) {
    if (!node || !point || !camera || !viewport) { if (node) node.hidden = true; return; }
    const p = point.clone().project(camera);
    node.hidden = p.z < -1 || p.z > 1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1;
    if (node.hidden) return;
    const width = viewport.clientWidth, height = viewport.clientHeight;
    const half = Math.min(width / 2 - 8, Math.max(margin, (node.offsetWidth || 220) / 2));
    node.style.left = Math.max(half + 8, Math.min(width - half - 8, (p.x * .5 + .5) * width)) + 'px';
    node.style.top = Math.max((node.offsetHeight || 48) + 15, Math.min(height - 20, (-p.y * .5 + .5) * height)) + 'px';
  }
  function reaction(actor, elapsed, witness = false) {
    if (!actor?.root.visible || reducedMotion?.matches) return;
    const head = actor.root.getObjectByName('Head pivot');
    const arm = actor.root.getObjectByName(witness ? 'Left arm' : 'Right arm');
    if (head) head.rotation.z += (witness ? -.16 : .12) * Math.min(1, elapsed * 3);
    if (arm && !witness && elapsed < 1.8) arm.rotation.z -= Math.sin(Math.min(1, elapsed / 1.8) * Math.PI) * .7;
  }
  function update(data, actors, time, {camera, paused = true} = {}) {
    if (disposed) return;
    const records = governmentSceneRecords(data.home);
    const identity = data.home?.householdId ?? data.household?.id ?? 'home';
    const snapshotMinute = data.home?.systems?.government?.minute;
    if (houseId !== identity || (Number.isFinite(snapshotMinute) && Number.isFinite(observedMinute) && snapshotMinute < observedMinute)) {
      houseId = identity; queue.length = 0; beat = null;
    }
    observedMinute = Number.isFinite(snapshotMinute) ? snapshotMinute : null;
    queue.push(...tracker.observe(identity, records.events, snapshotMinute));
    if (queue.length > 3) queue.splice(0, queue.length - 3);
    const retained = new Set(records.souvenirs.map(row => row.id));
    for (const [id, entry] of props) if (!retained.has(id)) { disposeProp(entry); props.delete(id); }
    for (const row of records.souvenirs) {
      let entry = props.get(row.id);
      if (!entry) { entry = makeProp(row); props.set(row.id, entry); }
      const anchor = objectAnchor(row.objectId);
      entry.group.visible = !!anchor;
      if (!anchor) { if (entry.label) entry.label.hidden = true; continue; }
      entry.group.position.copy(anchor).add(new THREE.Vector3(0, .04, 0));
      entry.group.rotation.z = 0;
      project(entry.label, anchor.clone().add(new THREE.Vector3(0, 1.25, 0)), camera);
    }
    if (!beat && queue.length && !paused) beat = {event: queue.shift(), start: time};
    if (beat && time - beat.start > (beat.event.witness?.quote ? 10 : 5)) beat = null;
    confetti.visible = false;
    accent.visible = false;
    ring.visible = false;
    if (speech) speech.hidden = true;
    if (beat) {
      const {event} = beat, elapsed = Math.max(0, time - beat.start);
      const witnessTurn = elapsed >= 5.2 && !!event.witness?.quote;
      const actor = actors.get(String(witnessTurn ? event.witness.personId : event.personId));
      const objectPoint = objectAnchor(event.objectId);
      if (!objectPoint) { beat = null; return; }
      let anchor = witnessTurn && actor?.root.visible ? actor.root.position.clone().add(new THREE.Vector3(0, 2.75, 0)) : objectPoint.clone();
      if (!witnessTurn) anchor.y += 1.45;
      const quote = witnessTurn ? event.witness.quote : event.quote;
      const speaker = witnessTurn ? event.witness.name : event.speaker;
      setSpeech(event.id + ':' + witnessTurn, speaker, quote);
      if (elapsed < 4.8 || witnessTurn) project(speech, anchor, camera, 130);
      if (!paused) reaction(actor, witnessTurn ? elapsed - 5.2 : elapsed, witnessTurn);
      const completion = event.type === 'government-completed';
      if (completion && elapsed < 1.8 && !reducedMotion?.matches) {
        const souvenir = [...props.values()].find(entry => entry.record.episodeId === event.episodeId);
        if (souvenir) souvenir.group.rotation.z = Math.sin(elapsed * 12) * .12 * (1 - elapsed / 1.8);
        if (['flush', 'squeak', 'raspberry', 'gulp'].includes(event.effect)) {
          accent.visible = true;
          accent.position.copy(objectPoint).add(new THREE.Vector3(0, .45, 0));
          accentMaterial.color.set(event.effect === 'flush' ? '#71a3b0' : '#d37e96');
          accentMaterial.opacity = Math.max(0, 1 - elapsed / 1.8);
          for (let i = 0; i < ripples.length; i++) {
            const swell = 1 + elapsed * 1.8 + i * .6;
            ripples[i].scale.setScalar(swell);
            ripples[i].rotation.set(event.effect === 'flush' ? -Math.PI / 2 : 0, 0, elapsed * 2);
            ripples[i].position.set(0, i * .13 + elapsed * .25, i * .08);
          }
        }
      }
      if (completion && objectPoint && elapsed < 2 && !reducedMotion?.matches && !['flush', 'squeak', 'raspberry', 'gulp'].includes(event.effect)) {
        confetti.visible = true;
        confetti.position.copy(objectPoint).add(new THREE.Vector3(0, .5, 0));
        for (let i = 0; i < bits.length; i++) {
          const angle = i * 2.39996, radius = elapsed * (.32 + (i % 4) * .12);
          bits[i].position.set(Math.cos(angle) * radius, .7 + elapsed * (1.1 + (i % 3) * .18) - elapsed * elapsed * .9, Math.sin(angle) * radius);
          bits[i].rotation.set(elapsed * (i % 3 + 1), angle + elapsed, elapsed * 2);
        }
      }
    } else if (records.active) {
      const active = records.active, anchor = objectAnchor(active.objectId);
      if (anchor) {
        ring.visible = true;
        ring.position.set(anchor.x, anchor.y + .035, anchor.z);
        ring.material.opacity = reducedMotion?.matches ? .55 : .55 + Math.sin(time * 3) * .15;
        setSpeech('active:' + active.actionId, 'HOUSEHOLD NONSENSE', active.title ?? 'A perfectly normal household meeting.');
        project(speech, anchor.add(new THREE.Vector3(0, 1.25, 0)), camera, 130);
      }
    }
  }
  return {
    group, update,
    getPickables: () => [...props.values()].filter(entry => entry.group.visible).flatMap(entry => {
      const meshes = []; entry.group.traverse(node => { if (node.isMesh) meshes.push(node); }); return meshes;
    }),
    getDebug: () => ({souvenirs: [...props.values()].filter(entry => entry.group.visible).map(entry => ({id: entry.record.id, kind: entry.record.kind, objectId: entry.record.objectId, title: entry.record.title})), speaking: speech && !speech.hidden ? speech.textContent : null, effect: beat?.event.id ?? null}),
    destroy() {
      disposed = true;
      speech?.remove();
      for (const entry of props.values()) disposeProp(entry);
      props.clear(); queue.length = 0; beat = null; tracker.clear();
      for (const geometry of geometries) geometry.dispose();
      for (const m of materials) m.dispose();
      geometries.clear(); materials.clear(); group.removeFromParent();
    },
  };
}
