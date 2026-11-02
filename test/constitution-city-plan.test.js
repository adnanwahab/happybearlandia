import { describe, expect, test } from "bun:test";
import snapshot from "../world/constitution-city/dear-congress-plan.json";
import { normalizeDearCongressPlan, applyClausePlan } from "../world/constitution-city/plan.js";
import { createCity } from "../world/city/seed.js";
import { createEngine, cityMetrics } from "../world/city/engine.js";

const normalize = () => normalizeDearCongressPlan(snapshot);
describe("Dear Congress public clause adapter", () => {
  test("production Balanced A exact IDs/titles/texts are retained with public provenance", () => {
    const plan = normalize();
    expect(plan.clauses.map((clause) => clause.id)).toEqual(["s_311","h_lots","cc_licensing","sb_filing","fx_review","h_vouchers","cc_subsidy","f_drainage","t_brt","mh_988"]);
    const source = snapshot.packages.find((row) => row.id === "A");
    for (const clause of plan.clauses) {
      const raw = source.items.find((row) => row.proposal.id === clause.id).proposal;
      expect(clause.title).toBe(raw.title);
      expect(clause.text).toBe(raw.text || raw.title);
      expect(clause.costB).toBe(raw.costB);
      expect(clause.authority).toBe(raw.authority);
    }
    expect(plan.provenance.retrievedAt).toBe(snapshot.retrievedAt);
    expect(plan.provenance.sourceType).toContain("not enacted");
    expect(normalizeDearCongressPlan(plan).clauses.map((row) => [row.text,row.textSource])).toEqual(plan.clauses.map((row) => [row.text,row.textSource]));
  });
  test("privacy allowlist drops journals, quotes, individual answers and arbitrary metadata", () => {
    const raw = { id:"A", name:"Public", items:[{proposal:{id:"h_lots",title:"Exact title",text:"Exact policy body\nwith newline",costB:0,authority:"Council",evidence:.7,rightsIssue:"Source concern",dependencies:["d1"],conflicts:["c1"],journal:"PRIVATE_RECORD"},quotes:[{text:"PRIVATE_RECORD",author:"PRIVATE_AUTHOR"}],yourAnswers:["PRIVATE_RECORD"]}],entries:["PRIVATE_RECORD"] };
    const plan = normalizeDearCongressPlan(raw);
    expect(plan.clauses[0].text).toBe("Exact policy body\nwith newline");
    expect(plan.clauses[0].dependencies).toEqual(["d1"]);
    expect(plan.clauses[0].rightsContext.legalDetermination).toBe(false);
    expect(JSON.stringify(plan)).not.toContain("PRIVATE_RECORD");
    expect(JSON.stringify(plan)).not.toContain("PRIVATE_AUTHOR");
  });
  test("only reviewed mechanisms forecast; childcare, vouchers and crisis services never become housing", () => {
    const plan = normalize();
    expect(plan.clauses.filter((row) => row.supported).map((row) => row.id)).toEqual(["h_lots","f_drainage","t_brt"]);
    const original = createCity({households:12}), state = applyClausePlan(original,plan,{clauseIds:["h_vouchers","cc_subsidy","mh_988"]});
    expect(state.policies).toEqual([]);
    expect(state.provenance.constitutionPlan.unavailable.length).toBe(3);
    expect(state.finance).toEqual(original.finance);
    expect(state.units).toEqual(original.units);
  });
  test("scaled clause budgets sum once, never once per district, and remain unbilled until funding", () => {
    const original = createCity({households:12}), before = structuredClone(original);
    const state = applyClausePlan(original,normalize());
    expect(original).toEqual(before);
    expect(state).not.toBe(original);
    expect(state.finance).toEqual(before.finance);
    const ledger = state.provenance.constitutionPlan;
    expect(ledger.committedLocalBudgetUsd).toBe(260000);
    expect(state.policies.reduce((sum,policy) => sum+policy.cost,0)).toBeCloseTo(260000,8);
    expect(state.policies.filter((policy) => policy.clauseId === "t_brt").length).toBe(1);
    expect(state.policies.filter((policy) => policy.clauseId === "f_drainage").reduce((sum,policy) => sum+policy.cost,0)).toBeCloseTo(200000,8);
    const result = createEngine().run(state,60);
    const fundedMoney = result.steps.flatMap((step) => step.flows).filter((flow) => flow.system === "governance" && flow.resource === "money").reduce((sum,flow) => sum+flow.amount,0);
    expect(fundedMoney).toBeCloseTo(260000,8);
  });
  test("actual city-engine outcomes and completed projects change, not invented metric fields", () => {
    const original = createCity({households:12}), state = applyClausePlan(original,normalize(),{clauseIds:["f_drainage","t_brt"]});
    const result = createEngine().run(state,36);
    expect(result.state.projects.some((project) => project.type === "transit" && project.stage === "completion")).toBe(true);
    expect(result.state.districts.every((district) => district.resilience >= .12)).toBe(true);
    expect(result.state.links.some((link) => link.mode === "transit" && link.capacity > original.links.find((row) => row.id === link.id).capacity)).toBe(true);
    expect(Object.values(cityMetrics(result.state)).every(Number.isFinite)).toBe(true);
  });
  test("upzone compliance is applied once and legal baselines support attributed reversals", () => {
    const original = createCity({households:12});
    const state = applyClausePlan(original,normalize(),{clauseIds:["h_lots"],compliance:.5});
    expect(state.policies.every((policy) => policy.amount === 2)).toBe(true);
    expect(state.constitutionCity.clausePolicies.every((row) => row.clauseId === "h_lots" && row.legalDeltas[0].capacityDelta === 2)).toBe(true);
    const result = createEngine().run(state,4);
    for (const parcel of original.parcels) expect(result.state.parcels.find((row) => row.id === parcel.id).capacity).toBe(parcel.capacity+2);
    expect(() => applyClausePlan(state,normalize(),{clauseIds:["h_lots"]})).toThrow("already compiled");
    expect(applyClausePlan(original,normalize(),{compliance:0}).policies).toEqual([]);
  });
  test("delay is real, unknown IDs/options fail, and unsupported sunset is explicit", () => {
    const original = createCity({households:12}), plan = normalize();
    const delayed = applyClausePlan(original,plan,{clauseIds:["h_lots"],delayMonths:12});
    expect(createEngine().run(delayed,6).state.policies.every((policy) => policy.stage === "PROPOSED")).toBe(true);
    expect(() => applyClausePlan(original,plan,{sunsetYears:2})).toThrow("sunset");
    expect(() => applyClausePlan(original,plan,{clauseIds:["missing"]})).toThrow();
    expect(() => applyClausePlan(original,plan,{compliance:NaN})).toThrow();
    expect(() => normalizeDearCongressPlan(snapshot,{packageId:"missing"})).toThrow();
    expect(() => normalizeDearCongressPlan({id:"A",items:[{id:"duplicate",title:"one"},{id:"duplicate",title:"two"}]})).toThrow();
  });
});
