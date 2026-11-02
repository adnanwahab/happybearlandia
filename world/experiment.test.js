import { describe, expect, test } from "bun:test";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildTown } from "./gen.js";
import { runExperiment, selectFloodedBuildingIds } from "./experiment.js";

const DEAR_CONGRESS_ROOT_CANDIDATES = [
  process.env.DEAR_CONGRESS_ROOT,
  "../dear_congress",
  "../Desktop/dear_congress",
  "../../dear_congress",
  "../../Desktop/dear_congress",
].filter(Boolean);

function makeTown(maxPeople = 300) {
  const origin = { lat: 40.7265, lng: -73.9815 };
  const area = { source: "none" };
  return buildTown(origin, area, { maxPeople });
}

function fakePlanPayload() {
  return [
    { name: "Balanced", items: [{ proposal: { id: "t_brt" } }, { proposal: { id: "f_drainage" } }, { proposal: { id: "s_311" } }] },
    { name: "Minimal change", items: [{ proposal: { id: "t_bus" } }] },
    { name: "Most popular", items: [{ proposal: { id: "f_buyouts" } }, { proposal: { id: "h_vouchers" } }] },
  ];
}

describe("runExperiment", () => {
  test("storm week journals include flooding and outcomes include storm impacts", async () => {
    const town = makeTown(320);
    const calls = [];
    const years = 2;
    const byYear = [];

    await runExperiment({
      town,
      packageName: "Balanced",
      years,
      seed: "exp-seed-flood",
      fetchPlan: async (body) => {
        calls.push(body);
        return fakePlanPayload();
      },
      onYear: (y) => byYear.push(y),
    });

    expect(calls.length).toBe(years);
    const year2Input = calls[1]?.extraEntries || [];
    expect(Array.isArray(year2Input)).toBe(true);
    expect(year2Input.some((e) => String(e?.text || "").toLowerCase().includes("flood"))).toBe(true);

    const year1 = byYear.find((y) => y.year === 1);
    expect(year1).toBeTruthy();
    expect(Number(year1.outcomes.displacedResidents || 0)).toBeGreaterThan(0);
    expect(Number(year1.outcomes.avgParkLitter || 0)).toBeGreaterThan(0);
  }, 60000);

  test("same seed gives identical results", async () => {
    const town = makeTown(180);

    const once = async () => {
      const rows = [];
      await runExperiment({
        town,
        packageName: "Most popular",
        years: 3,
        seed: "deterministic-seed",
        fetchPlan: async () => fakePlanPayload(),
        onYear: (y) => rows.push({
          year: y.year,
          proposalIds: y.proposalIds,
          outcomes: y.outcomes,
        }),
      });
      return JSON.stringify(rows);
    };

    const a = await once();
    const b = await once();
    expect(a).toBe(b);
  }, 30000);

  test("drainage diagnostics use carried home locations and never require repeated displacement to report a result", async () => {
    const byYear=[];
    await runExperiment({town:makeTown(24),packageName:"Balanced",years:10,seed:"impact-raw-counts-check",experimentStartMs:0,fetchPlan:async()=>[{id:"balanced-pkg-id",name:"Balanced",items:[{proposal:{id:"f_drainage"}}]}],onYear:y=>byYear.push(y)});
    const fullEffect=byYear.filter(y=>y.year>=7);expect(fullEffect).toHaveLength(4);
    for(const row of fullEffect){const observed=row.stormDiagnostics,without=observed.displacedWithoutByItem.f_drainage,withIt=observed.displacedWithAll,expected=without>0?Math.max(0,Math.min(1,(without-withIt)/without)):0;expect(row.synthOutcomes.raw.impacts.f_drainage).toBe(expected);expect(row.methods.restoredPreviousSample).toBe(true);expect(row.outcomes.displacedResidents).toBeLessThanOrEqual(row.outcomes.observations.totals.residentDays/5);}
  },60000);

  test("flood zone ordering: 100-year zones flood before X at same severity", () => {
    const buildings = [
      { index: 0, kind: "home", floodZone: "X", center: [0, 0] },
      { index: 1, kind: "home", floodZone: "AE", center: [10, 0] },
      { index: 2, kind: "home", floodZone: "X500", center: [20, 0] },
      { index: 3, kind: "home", floodZone: "X", center: [30, 0] },
    ];
    const flooded = selectFloodedBuildingIds(buildings, "seed", 0.5); // 2/4
    expect(flooded.has(1)).toBe(true); // AE first
    expect(flooded.has(0) || flooded.has(3)).toBe(false); // X should not beat 100-year when slots are limited
  });

  test("replay severities come from outcomes fixture and peak in 2017", async () => {
    const town = makeTown(140);
    const history = [];
    const fixture = {
      outcomes: {
        series: [
          { needId: "flooding", year: 2015, severity: 0.2 },
          { needId: "flooding", year: 2016, severity: 0.5 },
          { needId: "flooding", year: 2017, severity: 1.0 },
          { needId: "flooding", year: 2018, severity: 0.4 },
          { needId: "flooding", year: 2019, severity: 0.3 },
          { needId: "flooding", year: 2020, severity: 0.6 },
          { needId: "flooding", year: 2021, severity: 0.4 },
          { needId: "flooding", year: 2022, severity: 0.7 },
          { needId: "flooding", year: 2023, severity: 0.5 },
          { needId: "flooding", year: 2024, severity: 0.6 },
        ],
      },
    };

    await runExperiment({
      town,
      packageName: "Balanced",
      mode: "replay",
      seed: "replay-fixture",
      fetchOutcomes: async () => fixture,
      fetchPlan: async () => fakePlanPayload(),
      onYear: (y) => { if (y.year > 0) history.push(y); },
    });

    const peak = [...history].sort((a, b) => Number(b.stormSeverity || 0) - Number(a.stormSeverity || 0))[0];
    expect(peak?.yearLabel).toBe("2017");
  }, 60000);

  test("passes previous/challengerStreak from year 2 onward (and sends {} in year 1)", async () => {
    const town = makeTown(220);
    const calls = [];

    await runExperiment({
      town,
      packageName: "Balanced",
      years: 3,
      seed: "previous-input-check",
      fetchPlan: async (body) => {
        calls.push(body || {});
        return [
          {
            id: "balanced-pkg-id",
            name: "Balanced",
            items: [
              { proposal: { id: "t_brt" } },
              { proposal: { id: "f_drainage" } },
            ],
            challengerStreak: { f_buyouts: body?.challengerStreak?.["balanced-pkg-id"]?.f_buyouts ? 2 : 1 },
          },
        ];
      },
    });

    expect(calls.length).toBe(3);
    expect(calls[0]?.previous).toEqual({});
    expect(calls[0]?.challengerStreak).toEqual({});
    expect(typeof calls[0]?.outcomes?.needs?.transit?.severity).toBe("number");
    expect(typeof calls[0]?.outcomes?.needs?.flooding?.severity).toBe("number");
    expect(calls[1]?.previous).toEqual({
      "balanced-pkg-id": ["t_brt", "f_drainage"],
    });
    expect(calls[1]?.challengerStreak).toEqual({
      "balanced-pkg-id": { f_buyouts: 1 },
    });
    expect(calls[2]?.previous).toEqual({
      "balanced-pkg-id": ["t_brt", "f_drainage"],
    });
    expect(calls[2]?.challengerStreak).toEqual({
      "balanced-pkg-id": { f_buyouts: 2 },
    });
    expect(calls[2]?.outcomes?.items?.t_bus).toMatchObject({impact:null,available:false});
    expect(calls[2]?.outcomes?.items?.t_brt).toMatchObject({impact:null,available:false});
  }, 30000);

  test("replay fallback works when outcomes are unavailable", async () => {
    const town = makeTown(160);
    const seen = [];

    await runExperiment({
      town,
      packageName: "Balanced",
      mode: "replay",
      seed: "replay-fallback",
      fetchOutcomes: async () => { throw new Error("outcomes down"); },
      fetchPlan: async () => fakePlanPayload(),
      onYear: (y) => { if (y.year > 0) seen.push(y); },
    });

    expect(seen.length).toBe(10);
    expect(seen.every((y) => Number.isFinite(Number(y.stormSeverity)))).toBe(true);
    expect(seen.every((y) => y.replayDataSource === "simulated")).toBe(true);
  }, 60000);

  test("10-year 3-package what-if run does not change dear-congress entries or answers", async () => {
    let dearCongressRoot = null;
    for (const candidate of DEAR_CONGRESS_ROOT_CANDIDATES) {
      if (!candidate) continue;
      const abs = isAbsolute(candidate) ? candidate : resolve(process.cwd(), candidate);
      if (await Bun.file(resolve(abs, "server.ts")).exists()) {
        dearCongressRoot = abs;
        break;
      }
    }
    if (!dearCongressRoot) {
      // Workspace may not include dear_congress; skip quietly when absent.
      return;
    }

    const previous = {
      DB_PATH: process.env.DB_PATH,
      PORT: process.env.PORT,
      DEBUG_REQUEST_LOGS: process.env.DEBUG_REQUEST_LOGS,
    };

    const engineUrl = pathToFileURL(resolve(dearCongressRoot, "src/engine/engine.ts")).href;
    const catalogUrl = pathToFileURL(resolve(dearCongressRoot, "src/engine/catalog.ts")).href;
    const { emptyDB, extract } = await import(engineUrl);
    const { SEED_JOURNALS } = await import(catalogUrl);

    const dbPath = resolve(dearCongressRoot, `data/test-db-${crypto.randomUUID()}.json`);
    const db = emptyDB();
    db.entries = SEED_JOURNALS.map((s, i) => ({
      id: `seed-${i}`,
      author: s.author,
      text: s.text,
      createdAt: new Date(1_700_000_000_000 + i * 60_000).toISOString(),
      extraction: extract(s.text),
      corrected: false,
      seeded: true,
    }));
    await Bun.write(dbPath, JSON.stringify(db, null, 2));

    process.env.DB_PATH = dbPath;
    process.env.PORT = "0";
    process.env.DEBUG_REQUEST_LOGS = "0";

    let srv = null;
    try {
      const serverUrl = `${pathToFileURL(resolve(dearCongressRoot, "server.ts")).href}?it=${crypto.randomUUID()}`;
      const mod = await import(serverUrl);
      srv = mod.server;

      const api = (path) => new URL(path, srv.url).toString();
      const stateBeforeRes = await fetch(api("/api/state"));
      expect(stateBeforeRes.ok).toBe(true);
      const stateBefore = await stateBeforeRes.json();
      const beforeEntries = Array.isArray(stateBefore?.entries) ? stateBefore.entries.length : 0;
      const beforeAnswers = Array.isArray(stateBefore?.user?.answers) ? stateBefore.user.answers.length : 0;

      const town = makeTown(220);
      const packages = ["Balanced", "Minimal change", "Most popular"];
      for (const packageName of packages) {
        await runExperiment({
          town,
          packageName,
          years: 10,
          seed: "dc-no-write-check",
          fetchPlan: async (body) => {
            const res = await fetch(api("/api/synthesize"), {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body || {}),
            });
            if (!res.ok) throw new Error(`synthesize failed: HTTP ${res.status}`);
            return res.json();
          },
        });
      }

      const stateAfterRes = await fetch(api("/api/state"));
      expect(stateAfterRes.ok).toBe(true);
      const stateAfter = await stateAfterRes.json();
      const afterEntries = Array.isArray(stateAfter?.entries) ? stateAfter.entries.length : 0;
      const afterAnswers = Array.isArray(stateAfter?.user?.answers) ? stateAfter.user.answers.length : 0;
      expect(afterEntries).toBe(beforeEntries);
      expect(afterAnswers).toBe(beforeAnswers);
    } finally {
      if (srv?.stop) srv.stop(true);
      await Bun.file(dbPath).delete();
      process.env.DB_PATH = previous.DB_PATH;
      process.env.PORT = previous.PORT;
      process.env.DEBUG_REQUEST_LOGS = previous.DEBUG_REQUEST_LOGS;
    }
  }, 180000);
});
