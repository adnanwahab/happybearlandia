import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { createTrafficVehicleMetadata, renderVehicleCabin, vehicleIllustrativeOccupants } from "../world/vehicle-inspector.js";
import { createCityDetails } from "../world/render/environment/city-details.js";

describe("truthful decorative traffic cabin", () => {
  test("stable instance metadata makes anonymous illustration seats without resident/trip claims", () => {
    const vehicle = createTrafficVehicleMetadata(3, { color: 0xb65e43, routeIndex: 2 });
    expect(vehicle).toEqual(createTrafficVehicleMetadata(3, { color: 0xb65e43, routeIndex: 2 }));
    expect(vehicle.occupants).toHaveLength(4);
    expect(vehicle.occupants.every(occupant => occupant.illustrative)).toBe(true);
    expect(vehicle.occupantProvenance).toBe("illustrative");
    expect(vehicle.trafficProvenance).toBe("decorative-traffic");
    expect(JSON.stringify(vehicle)).not.toMatch(/residentId|tripId|destination|customer|journal/);
    expect(Object.isFrozen(vehicle.occupants)).toBe(true);
    expect(() => createTrafficVehicleMetadata(-1)).toThrow();
  });
  test("visible SVG cabin includes seats, steering wheel and seated avatars without injecting supplied names/colors", () => {
    const vehicle = createTrafficVehicleMetadata(3);
    const svg = renderVehicleCabin(vehicle);
    expect(svg.match(/class="vi-occupant"/g)).toHaveLength(4);
    expect(svg).toContain("ROOF REMOVED"); expect(svg).toContain("not tracked resident passengers");
    expect(svg).toContain('data-vi-seat="front-left"'); expect(svg).toContain('tabindex="0"');
    const hostile = { color: '\" onload="alert(1)', occupants: [{ seatId: "front-left", name: "Private resident", color: '\" onload="boom' }, { seatId: "invented", name: "someone" }] };
    expect(renderVehicleCabin(hostile)).not.toContain("onload=");
    expect(renderVehicleCabin(hostile)).not.toContain("Private resident");
    expect(vehicleIllustrativeOccupants(hostile)).toHaveLength(1);
  });
});

describe("instanced car picking", () => {
  test("raycast returns actual instance identity/pose/distance and ignores hidden traffic", () => {
    const scene = new THREE.Scene();
    const details = createCityDetails(scene, { roads: [{ pts: [[0, 0], [100, 0]] }], buildings: [] });
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 50, 0);
    details.update(0, 0.016, camera, { density: 1, geometryRadius: 1 }, {});
    const car = details.getVehicle(0);
    expect(car.instanceId).toBe(0); expect(car.active).toBe(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(car.position.x, 20, car.position.z), new THREE.Vector3(0, -1, 0));
    const picked = details.pickVehicle(ray);
    expect(picked.id).toBe(car.id); expect(picked.instanceId).toBe(0); expect(picked.distance).toBeGreaterThan(0);
    const previous = details.getVehicle(0); details.update(1000, 0.016, camera, { density: 1 }, {});
    expect(details.getVehicle(0).id).toBe(previous.id);
    expect(details.getVehicle(0).position.x).not.toBe(previous.position.x);
    details.update(1100, 0.016, camera, { density: 1 }, { traffic: false });
    expect(details.pickVehicle(ray)).toBeNull(); expect(details.getVehicle(0).active).toBe(false);
    details.dispose(); expect(scene.children).toHaveLength(0);
  });
  test("moving far-origin cars remain ray-pickable and visual speed does not scale with road length", () => {
    const speed = [];
    for (const length of [100, 800]) {
      const details = createCityDetails(new THREE.Scene(), { roads: [{ pts: [[10000, 12000], [10000 + length, 12000]] }], buildings: [] });
      const camera = new THREE.PerspectiveCamera(45, 1.5, 1, 5000);
      const xPositions = [];
      for (const now of [0, 1000, 5000, 17000, 25000]) {
        details.update(now, 0.016, camera, { density: 0.125 }, {});
        const car = details.getVehicle(0); if (now <= 1000) xPositions.push(car.position.x);
        camera.position.set(car.position.x + 40, 45, car.position.z + 40);
        camera.lookAt(car.position.x, car.position.y, car.position.z); camera.updateMatrixWorld();
        const screen = new THREE.Vector3(car.position.x, car.position.y, car.position.z).project(camera);
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(screen.x, screen.y), camera);
        expect(details.pickVehicle(ray)?.id).toBe(car.id);
      }
      speed.push(Math.abs(xPositions[1] - xPositions[0])); details.dispose();
    }
    expect(speed[0]).toBeCloseTo(6, 2); expect(speed[1]).toBeCloseTo(6, 2);
  });

});
