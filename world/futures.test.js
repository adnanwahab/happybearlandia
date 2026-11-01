import { describe, expect, test } from "bun:test";
import { buildTown } from "./gen.js";
import { snapshotToPlan } from "./multiverse.js";
import {
  CONDITION_KEYS, decodeAssumptions, defaultAssumptions, encodeAssumptions, planVariants, runFuture, runFutures, simYears, worldPath,
} from "./futures.js";
import {
  buildLives, butterflyPoints, comparePlans, divergenceTree, explainVariance, lifeImpact, parseQuery, robustness, scoreFutures, searchFutures, weirdWorlds, yearStory,
} from "./futures-analysis.js";

const spec = snapshotToPlan({ plan: { label: "Balanced", proposalIds: ["t_bus", "f_drainage", "s_311"] } });
const town = () => buildTown({ lat: 29.7286, lng: -95.4746 }, null, { maxPeople: 24 });

describe("world paths", () => {
  test("deterministic per seed, different across seeds", () => {
    const a = worldPath("s:reality:1", 10), b = worldPath("s:reality:1", 10), c = worldPath("s:reality:2", 10);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
    expect(a.years).toHaveLength(10);
  });

  test("a branch changes nothing before it and keeps the same random steps after", () => {
    const a = worldPath("s:reality:7", 10);
    const k = "economy";
    const b = worldPath("s:reality:7", 10, null, { fromYear: 5, set: { [k]: a.years[4].base[k] + 0.1 } });
    for (let y = 0; y < 4; y++) expect(b.years[y]).toEqual(a.years[y]);
    // Underlying drift is unchanged, so the gap stays ~0.1 until clamping.
    expect(b.years[6].base[k] - a.years[6].base[k]).toBeCloseTo(0.1, 3);
  });

  test("forcing and blocking shocks", () => {
    const forced = worldPath("s:reality:3", 6, null, { force: [{ id: "pandemic", year: 2 }] });
    expect(forced.years[1].started).toContain("pandemic");
    expect(forced.years[2].active.some((s) => s.id === "pandemic")).toBe(true);
    const all = worldPath("s:reality:3", 6, { shockRates: Object.fromEntries(Object.keys(defaultAssumptions().shockRates).map((k) => [k, 0.9])) });
    const blocked = worldPath("s:reality:3", 6, { shockRates: { recession: 0.9 } }, { fromYear: 1, block: [{ id: "recession" }] });
    expect(all.shocks.length).toBeGreaterThan(5);
    expect(blocked.shocks.some((s) => s.id === "recession")).toBe(false);
  });

  test("shock rates are configurable and roughly respected", () => {
    let none = 0, many = 0;
    for (let i = 0; i < 50; i++) {
      none += worldPath(`q:reality:${i}`, 10, { shockRates: Object.fromEntries(Object.keys(defaultAssumptions().shockRates).map((k) => [k, 0])) }).shocks.length;
      many += worldPath(`q:reality:${i}`, 10).shocks.length;
    }
    expect(none).toBe(0);
    expect(many / 50).toBeGreaterThan(2);
    expect(many / 50).toBeLessThan(12);
  });

  test("assumptions round-trip through the URL form", () => {
    expect(encodeAssumptions(defaultAssumptions())).toBe("");
    const a = decodeAssumptions(encodeAssumptions({ shockRates: { recession: 0.2 }, volatility: 2 }));
    expect(a.shockRates.recession).toBe(0.2);
    expect(a.volatility).toBe(2);
    expect(simYears(10, 3)).toEqual([1, 4, 7, 10]);
  });

  test("plan variants include without/only/plus", () => {
    const v = planVariants(spec).map((x) => x.id);
    expect(v).toContain("without:t_bus");
    expect(v).toContain("only:f_drainage");
    expect(v.some((x) => x.startsWith("plus:"))).toBe(true);
  });
});

describe("futures + analysis", async () => {
  const t = town();
  const variant = planVariants(spec).find((x) => x.id === "only:t_bus").spec;
  const futures = await runFutures({ town: t, plans: [spec, variant], runs: 14, baseSeed: "test", years: 4, step: 3 });
  const scored = scoreFutures(futures);

  test("every future has every year and plan", () => {
    expect(futures).toHaveLength(14);
    expect(futures[0].simYears).toEqual([1, 4]);
    expect(futures[0].years[4].plans).toHaveLength(2);
    expect(futures[0].path).toHaveLength(4);
  }, 120000);

  test("scores, robustness and plan comparison", () => {
    expect(scored.rows).toHaveLength(14);
    const r = robustness(scored);
    expect(r.beneficial + r.mixed + r.harmful).toBe(14);
    const cmp = comparePlans(scored, ["Balanced", "Only buses"]);
    expect(cmp.plans[0].wins + cmp.plans[1].wins).toBe(14);
    expect(cmp.perWorld[0].finals).toHaveLength(2);
  });

  test("variance explanation adds up", () => {
    const m = explainVariance(futures, scored.rows.map((r) => r.final[0]), { permutations: 20 });
    const g = m.groups.reduce((s, x) => s + x.share, 0);
    expect(g + m.residual).toBeCloseTo(1, 2);
    expect(m.features.length).toBeGreaterThan(5);
    const tree = divergenceTree(futures, scored, { maxDepth: 2 });
    expect(tree.root.n).toBe(14);
    const b = butterflyPoints(futures, m, { top: 3 });
    expect(b.tried).toBeGreaterThan(100);
    const w = weirdWorlds(futures, scored, m, { top: 3 });
    expect(w.worlds).toHaveLength(3);
    expect(w.worlds[0].rarity).toBeLessThanOrEqual(w.worlds[2].rarity);
  });

  test("query parsing", () => {
    const q = parseQuery("worlds where well-being rises but walking gets worse");
    expect(q.clauses.map((c) => c.type)).toEqual(["metric", "metric"]);
    expect(q.clauses[1]).toMatchObject({ key: "avgWalkMinutes", dir: "up" });
    expect(parseQuery("plan fails despite high delivery").clauses.map((c) => c.type)).toEqual(["verdict", "cond"]);
    expect(parseQuery("recession followed by recovery").clauses[0]).toMatchObject({ type: "shock", id: "recession", recovery: true });
    expect(parseQuery("no hurricane by year 3").clauses[0]).toMatchObject({ negate: true, year: { op: "by", year: 3 } });
    expect(parseQuery("inequality falls by >20%").unknown.length).toBe(1);
    const all = searchFutures("", futures, scored);
    expect(all.matches).toHaveLength(14);
    const some = searchFutures("plan succeeds", futures, scored);
    expect(some.matches.length).toBe(robustness(scored).beneficial);
  });

  test("branch from here and a resident's life", async () => {
    const f = futures[0];
    const branch = await runFuture({ town: t, plans: [spec], index: f.index, baseSeed: "test", years: 4, step: 3, override: { fromYear: 4, set: { economy: 0.4 } }, reuse: { years: Object.fromEntries(Object.entries(f.years).map(([y, v]) => [y, { ...v, plans: [v.plans[0]] }])) } });
    expect(branch.years[1]).toEqual({ ...f.years[1], plans: [f.years[1].plans[0]] });
    expect(branch.path[3].base.economy).toBe(0.4);
    const lived = await runFuture({ town: t, plans: [spec], index: 2, baseSeed: "test", years: 4, step: 3, collectPeople: true });
    const lives = buildLives(lived);
    expect(lives.length).toBe(t.people.length);
    expect(lives[0].years).toHaveLength(2);
    expect(Number.isFinite(lifeImpact(lives[0]))).toBe(true);
    expect(Array.isArray(yearStory(lived, 1))).toBe(true);
  }, 120000);

  test("conditions all reach the simulation", () => {
    for (const k of CONDITION_KEYS) expect(futures[0].path[0].eff[k]).toBeDefined();
  });
});
