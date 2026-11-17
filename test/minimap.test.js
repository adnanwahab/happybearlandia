import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { loadedMinimapBounds, minimapLoadedChunks, minimapTransform, panMinimapCamera } from "../world/minimap.js";

describe("2D minimap coordinates and camera translation", () => {
  const bounds = { minX: -400, maxX: 600, minZ: -200, maxZ: 300 };
  test("north is up; non-square bounds keep aspect and round-trip meters", () => {
    const map = minimapTransform(bounds);
    expect(map.toMap(0, -100)[1]).toBeLessThan(map.toMap(0, 100)[1]);
    expect(map.toMap(100, 0)[0]).toBeGreaterThan(map.toMap(-100, 0)[0]);
    const original = { x: 142, z: -88 }, point = map.toMap(original.x, original.z);
    expect(map.toWorld(...point).x).toBeCloseTo(original.x);
    expect(map.toWorld(...point).z).toBeCloseTo(original.z);
    expect(map.toWorld(-100, -100)).toEqual({ x: bounds.minX, z: bounds.minZ });
    expect(minimapTransform(null)).toBeNull();
  });
  test("panning preserves camera offset, elevation, perspective distance, zoom and target height", () => {
    const camera = new THREE.PerspectiveCamera(45, 2, 1, 5000); camera.position.set(260, 320, 360); camera.zoom = 1.7;
    let updates = 0; const controls = { target: new THREE.Vector3(0, 7, 0), update() { updates++; } };
    const before = camera.position.clone().sub(controls.target), quaternion = camera.quaternion.clone();
    expect(panMinimapCamera(camera, controls, { x: 400, z: -220 })).toBe(true);
    expect(camera.position.clone().sub(controls.target).toArray()).toEqual(before.toArray());
    expect(camera.position.y).toBe(320); expect(camera.zoom).toBe(1.7); expect(controls.target.y).toBe(7);
    expect(camera.quaternion.toArray()).toEqual(quaternion.toArray()); expect(updates).toBe(1);
    expect(panMinimapCamera(camera, controls, { x: NaN, z: 0 })).toBe(false);
  });
  test("loaded extent uses explicit query bounds or available road/footprint data", () => {
    expect(loadedMinimapBounds({}, bounds)).toEqual(bounds);
    expect(loadedMinimapBounds({ roads: [{ pts: [[-20, -30], [40, 50]] }] })).toMatchObject({ minX: -20, maxX: 40, minZ: -30, maxZ: 50 });
    expect(loadedMinimapBounds({ buildings: [{ poly: [[0, 0], [10, 0], [10, 10]] }] })).toMatchObject({ minX: -10, maxX: 20 });
    expect(loadedMinimapBounds({})).toBeNull();
  });
  test("streamed coverage excludes queued/failed requests and uses actual partial response bounds", () => {
    const partial = { minX: 400, maxX: 550, minZ: -100, maxZ: 100 };
    const chunks = minimapLoadedChunks([{ key: "0:0", status: "resident", bounds, contextOnly: false }, { key: "1:0", status: "partial", bounds: { ...bounds, maxX: 2000 }, actualBounds: partial, contextOnly: true }, { status: "queued", bounds }, { status: "error", bounds, actualBounds: bounds }, { status: "fetching", bounds }]);
    expect(chunks).toHaveLength(2);
    expect(chunks[1].bounds).toEqual(partial);
    expect(chunks[1].contextOnly).toBe(true);
    expect(minimapLoadedChunks([{ status: "ready", actualBounds: { ...bounds, maxX: Infinity } }])).toEqual([]);
  });
});

import { createMinimapTrail } from '../world/minimap.js';
test('trail retains scoped stable identities, deduplicates and bounds page-session history', () => {
  const trail = createMinimapTrail();
  const record = {kind:'building',id:42,label:'Home'};
  trail.visit(record); trail.visit({kind:'person',id:42,label:'Resident'}); trail.visit(record);
  expect(trail.recent.map(e=>[e.kind,e.id])).toEqual([['building','42'],['person','42']]);
  record.label='mutated'; expect(trail.recent[0].label).toBe('Home');
  for(let i=0;i<10;i++)trail.visit({kind:'building',id:i});
  expect(trail.recent).toHaveLength(6); expect(trail.recent[0].id).toBe('9');
  expect(trail.visit({kind:'journal',id:1})).toBe(false);
});
test('bookmarks copy finite positions without mutating source records and have bounded lifetime', () => {
  const trail=createMinimapTrail(), point={x:12,z:-20,y:5}, before=JSON.stringify(point);
  trail.save(point); trail.save(point);
  expect(JSON.stringify(point)).toBe(before); expect(trail.bookmarks).toHaveLength(1);
  point.x=500; expect(trail.bookmarks[0].x).toBe(12);
  expect(trail.save({x:Infinity,z:0})).toBe(false);
  for(let i=0;i<10;i++)trail.save({x:i,z:i});
  expect(trail.bookmarks).toHaveLength(6); expect(createMinimapTrail().bookmarks).toEqual([]);
});

import {resolveMinimapVisit,minimapContains} from '../world/minimap.js';
test('return destinations resolve current IDs, never array indexes or old person coordinates',()=>{
  const town={buildings:[{id:'osm:42',center:[1,2]}],people:[{id:'legacy:42',x:3,z:4}]};
  const before=JSON.stringify(town);
  expect(resolveMinimapVisit(town,{kind:'building',id:'osm:42'})).toEqual({x:1,z:2});
  expect(resolveMinimapVisit(town,{kind:'person',id:'legacy:42'})).toEqual({x:3,z:4});
  expect(resolveMinimapVisit(town,{kind:'building',id:'0'})).toBeNull();
  expect(resolveMinimapVisit(town,{kind:'person',id:'osm:42'})).toBeNull();
  expect(JSON.stringify(town)).toBe(before);
  town.people[0].x=8;
  expect(resolveMinimapVisit(town,{kind:'person',id:'legacy:42'})).toEqual({x:8,z:4});
  town.people=[];
  expect(resolveMinimapVisit(town,{kind:'person',id:'legacy:42'})).toBeNull();
});
test('teleports reject missing coordinates and unloaded holes, including invalid saved locations',()=>{
 const regions=[{bounds:{minX:0,maxX:10,minZ:0,maxZ:10}},{bounds:{minX:20,maxX:30,minZ:0,maxZ:10}}];
 expect(minimapContains(regions,{x:10,z:0})).toBe(true);
 for(const point of [null,{x:NaN,z:0},{x:15,z:5},{x:31,z:5}])expect(minimapContains(regions,point)).toBe(false);
 expect(minimapContains([],{x:0,z:0})).toBe(false);
});
