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
