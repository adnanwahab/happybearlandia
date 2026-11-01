import { describe, expect, test } from "bun:test";
import { buildTown } from "./gen.js";
import { explainReality, leversOf } from "./explain.js";

const snapshot = {
  id: "sim_t",
  needs: [],
  plan: { label: "Balanced", proposalIds: ["t_brt", "f_drainage", "cc_licensing"], items: [
    { id: "t_brt", title: "Bus rapid transit" }, { id: "f_drainage", title: "Bayou drainage" }, { id: "cc_licensing", title: "Daycare licensing" },
  ] },
};

describe("explainReality", () => {
  test("splits each outcome into per-proposal causes plus 'together', and compares residents", async () => {
    const town = buildTown({ lat: 29.7286, lng: -95.4746 }, null, { maxPeople: 30 });
    const r = await explainReality({ town, snapshot, index: 3, baseSeed: "t", year: 6 });

    expect(r.seed).toBe("t:reality:3");
    expect(r.proposals.map((p) => p.proposalId)).toEqual(["t_brt", "f_drainage"]);
    expect(r.notModeled.map((x) => x.id)).toEqual(["cc_licensing"]);

    for (const [k, c] of Object.entries(r.causes)) {
      const sum = c.parts.reduce((s, p) => s + p.effect, 0) + c.together;
      expect(sum).toBeCloseTo(r.outcomes[k].delta, 2);
    }
    // Transit is what cuts walking; drainage is the only thing that changes storm displacement.
    expect(r.causes.avgWalkMinutes.parts[0].proposalId).toBe("t_brt");
    expect(r.causes.displacedResidents.parts.every((p) => p.proposalId === "f_drainage")).toBe(true);

    const c = r.people.counts;
    expect(c.better + c.worse + c.same).toBe(r.population);
    expect(r.people.better.length).toBeGreaterThan(0);
    expect(r.people.better[0].changes.walkMinutesPerDay).toHaveProperty("before");
  }, 60000);

  test("levers describe what a proposal does", () => {
    expect(leversOf("t_brt")).toEqual(["faster trips (transit)"]);
    expect(leversOf("sb_payroll")).toEqual(["more frequent restocking", "higher pay at small employers"]);
    expect(leversOf("hc_chc")).toEqual([]);
  });
});
