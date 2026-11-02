import { describe, expect, test } from "bun:test";
import { buildMuseumManifest, museumRoomById, summarizeMuseumManifest } from "../world/museum-manifest.js";

const record = {
  id: "record_1",
  experiment: {
    id: "exp_1",
    plan: { id: "plan_1", title: "Affordable Housing" },
    worldModel: { variables: [{ id: "interest_rate" }], causalEdges: [{ id: "edge_1" }], feedbackLoops: [] },
    lineage: { revision: 1 },
  },
  worldBatch: { worlds: [{ id: "w1" }, { id: "w2" }] },
  simulationBatch: { simulations: [
    { worldId: "w1", score: 20, timeline: [{ year: 1 }], world: { scenarioFamily: { id: "recession" } } },
    { worldId: "w2", score: 80, timeline: [{ year: 1 }], world: { scenarioFamily: { id: "boom" } } },
  ] },
  sensitivity: { failureModes: [{ id: "interest_rate" }] },
};

describe("museum manifest", () => {
  test("builds a walkable room sequence from one experiment", () => {
    const manifest = buildMuseumManifest(record);
    expect(manifest.schemaVersion).toBe("pensieve-museum-manifest.v1");
    expect(manifest.navigation.startRoomId).toBe("journal-plan");
    expect(museumRoomById(manifest, "future-landscape").data.simulations).toHaveLength(2);
    expect(summarizeMuseumManifest(manifest).portalCount).toBe(2);
  });

  test("omits empty revision rooms by default", () => {
    const manifest = buildMuseumManifest(record);
    expect(manifest.rooms.some((row) => row.id === "revision")).toBe(false);
    expect(buildMuseumManifest(record, { includeEmptyRooms: true }).rooms.some((row) => row.id === "revision")).toBe(true);
  });
});
