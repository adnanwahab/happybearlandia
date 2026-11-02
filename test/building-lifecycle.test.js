import { describe, expect, test } from "bun:test";
import { createBuildingProposal } from "../world/buildings/proposal.js";
import { createBuildingLifecycle } from "../world/buildings/lifecycle.js";
import { simulateHousingRun, simulateHousingRunV1, resolveHousingModel, housingModel, createHousingScenarios } from "../world/models/housing/index.js";

const tower = (overrides = {}) => createBuildingProposal({ id: "test-tower", status: "approved", ...overrides });
const simulate = (projects = [], options = {}) => simulateHousingRun({ seed: 42, years: 10, projects, ...options });
describe("building lifecycle and housing integration", () => {
  test("same project seed reproduces every stored month and events, other seeds vary", () => {
    const project = tower();
    const a = simulate([project]);
    expect(a).toEqual(simulate([project]));
    expect(a.projects[0].states).not.toEqual(simulate([project], { seed: 43 }).projects[0].states);
    expect(a.projects[0].states.length).toBe(121);
    expect(a.projects[0].states.map((state) => state.month)).toEqual(Array.from({ length: 121 }, (_, index) => index));
  });
  test("stores full construction phases, rising floors, one completion, and occupancy", () => {
    const result = simulate([tower()]);
    const project = result.projects[0];
    const phases = new Set(project.states.map((state) => state.status));
    for (const status of ["approved", "permitting", "site_prep", "excavation", "foundation", "structure", "floors", "envelope", "interior", "complete", "occupied"]) expect(phases.has(status)).toBe(true);
    expect(project.states.some((state) => state.floorsBuilt > 0 && state.floorsBuilt < 24)).toBe(true);
    expect(project.events.filter((event) => event.type === "PROJECT_COMPLETED").length).toBe(1);
    expect(project.states.at(-1).completedUnits).toBe(310);
    expect(project.states.at(-1).occupiedUnits).toBe(310);
    expect(project.states.at(-1).affordableUnits).toBe(90);
    expect(result.projectMetrics.completedUnits).toBe(310);
    expect(result.metrics.project_housing_units).toBe(310);
    expect(project.events.filter((event) => event.type === "FOUNDATION_COMPLETE").length).toBe(1);
  });
  test("short builds retain every monthly phase and never mutate input proposals", () => {
    const project = tower({ construction: { permitMonths: 0, buildMonths: 6 } });
    const before = structuredClone(project);
    const result = simulate([project]);
    expect(project).toEqual(before);
    const phases = new Set(result.projects[0].states.map((state) => state.status));
    for (const phase of ["site_prep", "excavation", "foundation", "structure", "floors", "envelope", "interior", "complete"]) expect(phases.has(phase)).toBe(true);
    expect(() => simulate([project, project])).toThrow("Duplicate");
  });
  test("proposed and cancelled projects have zero numerical effect; removal returns exact CRN baseline", () => {
    const original = simulate();
    for (const status of ["proposed", "cancelled"]) {
      const inert = simulate([tower({ status })]);
      expect(inert.metrics).toEqual(original.metrics);
      expect(inert.timeline).toEqual(original.timeline);
      expect(inert.accounting).toEqual(original.accounting);
      expect(inert.events).toEqual(original.events);
    }
    const input = { parameters: createHousingScenarios()[1].parameters, seed: 123, years: 10, projects: [tower()] };
    expect(simulateHousingRun({ ...input, projects: [] })).toEqual(simulateHousingRun({ parameters: input.parameters, seed: 123, years: 10 }));
  });
  test("projects reserve shared capacity and both mass and public costs reconcile", () => {
    const result = simulate([tower()]);
    const a = result.accounting;
    expect(a.capacityLedger.length).toBe(120);
    for (const month of a.capacityLedger) {
      expect(month.project + month.systemic).toBeLessThanOrEqual(month.total + 1e-8);
      expect(month.project + month.systemic + month.unused).toBeCloseTo(month.total, 6);
    }
    expect(a.finalHousing).toBeCloseTo(a.initialHousing + a.completedHomes - a.demolishedHomes, 5);
    expect(a.initialPipelineHomes + a.starts).toBeCloseTo(a.systemicCompletedHomes + a.pipelineHomes, 5);
    expect(a.completedHomes).toBeCloseTo(a.systemicCompletedHomes + a.projectCompletedHomes, 5);
    expect(a.projectCompletedHomes).toBe(310);
    expect(a.projectCapacityUsed).toBeCloseTo(result.projectMetrics.capacityUsed, 6);
    expect(result.metrics.public_expenditure).toBeCloseTo(a.subsidySpent + a.voucherSpent + a.projectPublicSpent, 6);
    expect(a.projectPublicSpent).toBeLessThanOrEqual(12000000);
    expect(a.projectPublicSpent).toBeGreaterThan(0);
    expect(result.projects[0].states.at(-1).totalCost).toBeGreaterThan(84000000);
    expect(result.projectMetrics.privateCost).toBeGreaterThan(result.projectMetrics.publicCost);
    expect(simulate([tower()], { parameters: { funding_delivery: 0 } }).metrics.project_public_cost).toBe(0);
  });
  test("completion changes the housing market against systemic policy alone", () => {
    const original = simulate();
    const intervention = simulate([tower()]);
    expect(intervention.metrics.housing_supply).toBeGreaterThan(original.metrics.housing_supply);
    expect(intervention.metrics.median_rent).toBeLessThan(original.metrics.median_rent);
    expect(intervention.accounting.starts).toBeLessThan(original.accounting.starts);
  });
  test("independent project random streams and deterministic capacity shortage", () => {
    const a = createBuildingLifecycle({ projects: [tower()], seed: 42 });
    const b = createBuildingLifecycle({ projects: [tower(), tower({ id: "another-tower" })], seed: 42 });
    expect(a.getProjects()[0].uncertainty).toEqual(b.getProjects().find((row) => row.projectId === "test-tower").uncertainty);
    for (let month = 1; month <= 60; month++) a.step({ month, capacity: 0 });
    const stalled = a.getProjects()[0];
    expect(stalled.states.at(-1).completedUnits).toBe(0);
    expect(stalled.states.at(-1).publicCost).toBe(0);
    expect(stalled.events.some((event) => event.cause === "capacity-shortage")).toBe(true);
  });
  test("seeded cancellation retains sunk costs without completed stock", () => {
    let cancelled;
    for (let seed = 0; seed < 200; seed++) {
      const result = simulate([tower()], { seed, parameters: { interest_rate: 0.2, funding_delivery: 0.1, resistance: 1 } });
      if (result.projectMetrics.cancelledProjects) { cancelled = result; break; }
    }
    expect(cancelled).toBeDefined();
    expect(cancelled.projectMetrics.completedUnits).toBe(0);
    expect(cancelled.projects[0].states.at(-1).status).toBe("cancelled");
    expect(cancelled.projects[0].events.some((event) => event.type === "PROJECT_CANCELLED")).toBe(true);
    expect(cancelled.projects[0].states.at(-1).publicCost).toBeGreaterThan(0);
  });
  test("timed stresses affect math only from their actual scheduled month", () => {
    const original = simulate();
    const later = simulate([], { scheduledStress: [{ presetId: "recession", startMonth: 37 }] });
    expect(later.timeline.filter((row) => row.year <= 3)).toEqual(original.timeline.filter((row) => row.year <= 3));
    expect(later.metrics).not.toEqual(original.metrics);
    expect(later.events.find((event) => event.type === "STRESS_PRESET_STARTED").month).toBe(37);
    expect(() => simulate([], { scheduledStress: [{ presetId: "missing", startMonth: 1 }] })).toThrow();
    expect(() => simulate([], { scheduledStress: [{ presetId: "recession", startMonth: "3" }] })).toThrow();
    const project = tower();
    const regular = simulate([project]);
    const cut = simulate([project], { scheduledStress: [{ presetId: "budget-cut", startMonth: 20 }] });
    expect(cut.projects[0].states.filter((state) => state.month < 20)).toEqual(regular.projects[0].states.filter((state) => state.month < 20));
    expect(cut.projectMetrics.publicCost).toBeLessThan(regular.projectMetrics.publicCost);
  });
  test("v1 resolver retains original numerical implementation and rejects new interventions", () => {
    expect(housingModel.version).toBe("1.2.0");
    const old = resolveHousingModel("1.0.0");
    expect(old.model.version).toBe("1.0.0");
    expect(old.simulateRun({ seed: 42, years: 10 })).toEqual(simulateHousingRunV1({ seed: 42, years: 10 }));
    expect(old.simulateRun({}).modelVersion).toBe("1.0.0");
    expect(old.model.metrics.some((metric) => metric.id === "project_housing_units")).toBe(false);
    expect(() => old.simulateRun({ projects: [tower()] })).toThrow();
    expect(() => resolveHousingModel("0.9.0")).toThrow();
    const current = simulate();
    const legacy = old.simulateRun({});
    for (const metric of old.model.metrics) expect(current.metrics[metric.id]).toBe(legacy.metrics[metric.id]);
  });
});
