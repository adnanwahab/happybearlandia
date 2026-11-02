import { expect, test } from "bun:test";
import { applyAreaEnrichment } from "../world/gen.js";

test("late keyed FEMA stamps existing building zones without resetting residents or runtime state", () => {
  const building = { id: "existing", center: [0, 0], floodZone: "X", state: { cash: 123, visitors: 4 } };
  const person = { id: 1, money: 77, home: 0 };
  const town = { origin: { lat: 29.75, lng: -95.35 }, buildings: [building], people: [person] };
  const area = { areaKey: "correct", floodZonesStatus: "ready", floodZonesSource: "fema-nfhl", floodZones: [{ zone: "AE", polygons: [[[29.74, -95.36], [29.76, -95.36], [29.76, -95.34], [29.74, -95.34]]] }] };
  const core = { areaKey: "correct", origin: town.origin, radiusM: 400, source: "osm", floodZonesStatus: "pending" };
  const overlay = { ...area, origin: town.origin, radiusM: 400 };
  expect(applyAreaEnrichment(town, core, { ...overlay, areaKey: "wrong" }).applied).toBe(false);
  expect(applyAreaEnrichment(town, core, { ...overlay, origin: { ...town.origin, lat: 30 } }).applied).toBe(false);
  expect(applyAreaEnrichment(town, core, { ...overlay, radiusM: 150 }).applied).toBe(false);
  expect(building.floodZone).toBe("X");
  expect(applyAreaEnrichment(town, core, overlay)).toMatchObject({ applied: true, updated: 1 });
  expect(core.source).toBe("osm");
  expect(core.floodZonesSource).toBe("fema-nfhl");
  expect(town.buildings[0]).toBe(building);
  expect(town.people[0]).toBe(person);
  expect(building.state).toEqual({ cash: 123, visitors: 4 });
  expect(person.money).toBe(77);
  expect(building.floodZone).toBe("AE");
  expect(applyAreaEnrichment(town, { ...area, floodZonesStatus: "error", floodZones: [] }).applied).toBe(false);
  expect(building.floodZone).toBe("AE");
});
