// Policy → metric → scene.
// The plan sets state, state drives the scene, every pixel traces to a number.
// All effect sizes below are ILLUSTRATIVE placeholders, same as costs in catalog.ts.

import type { PackageResult } from "./types";

/* ------------------------------------------------------------------ */
/* 1. World: where things are                                          */
/* ------------------------------------------------------------------ */

/** A geographic unit the sim tracks metrics for (watershed, corridor, tract…). */
export interface Zone {
  id: string;                    // "brays_bayou", "westheimer_corridor", "tract_48201_3101"
  kind: "watershed" | "corridor" | "tract" | "city" | "county" | "state";
  jurisdiction: string;          // matches Proposal.jurisdiction
  geojson: string;               // path to boundary/line in /data/geo
}

/** Starting value of a metric in a zone. Real data replaces these later. */
export interface Baseline {
  metric: string;                // matches Proposal.metrics, e.g. "structures_flooded_per_storm"
  zoneId: string;
  value: number;
  unit: string;
  source: string;                // "HCFCD 2024 flood report" — shown in the UI
}

/* ------------------------------------------------------------------ */
/* 2. Effects: what a policy does to a metric                          */
/* ------------------------------------------------------------------ */

export interface MetricEffect {
  metric: string;
  zones: string[] | "all-in-jurisdiction";
  change: { kind: "pct" | "abs"; mid: number; low: number; high: number };
  /** Years before anything moves (permits, construction, hiring). */
  lagYears: number;
  /** Years from first effect to full effect. */
  rampYears: number;
  /** Plain-language assumption the user can challenge ("what would change your mind"). */
  assumption: string;
  evidence: string;              // citation or "modeled"
}

export interface PolicyEffects {
  proposalId: string;            // matches Proposal.id
  effects: MetricEffect[];
}

/* ------------------------------------------------------------------ */
/* 3. Scene bindings: how a metric looks                               */
/* ------------------------------------------------------------------ */

export type Encoding =
  | { type: "water-level"; layer: string; maxDepthM: number }         // flood replay
  | { type: "tint-instances"; layer: string; flagWhen: string }        // houses flooded
  | { type: "vehicle-headway"; layer: string; minutesPerVehicle: string } // buses spawn rate
  | { type: "isochrone"; origin: string; minutes: string }             // reach in N min
  | { type: "extrude"; layer: string; heightPerUnit: number }          // new housing
  | { type: "heatmap"; layer: string; ramp: "sequential" | "diverging" };

export interface SceneBinding {
  metric: string;
  encoding: Encoding;
  /** What a hover tooltip says, with {value} {baseline} {delta} filled in. */
  label: string;
}

/* ------------------------------------------------------------------ */
/* 4. Run                                                              */
/* ------------------------------------------------------------------ */

export interface SimFrame {
  year: number;                  // 0 = plan adopted
  metrics: Record<string /*zoneId*/, Record<string /*metric*/, { mid: number; low: number; high: number }>>;
  /** Which plan items moved which numbers this year — powers "why did this change?" */
  attribution: { proposalId: string; metric: string; zoneId: string; delta: number }[];
}

function progress(e: MetricEffect, year: number): number {
  if (year < e.lagYears) return 0;
  if (e.rampYears === 0) return 1;
  return Math.min(1, (year - e.lagYears) / e.rampYears);
}

/** Deterministic: same plan, same frames. Effects compound multiplicatively for pct. */
export function simulate(
  pkg: PackageResult,
  zones: Zone[],
  baselines: Baseline[],
  catalog: PolicyEffects[],
  years = 10,
): SimFrame[] {
  const selected = new Set(pkg.items.map((i) => i.proposal.id));
  const active = catalog.filter((c) => selected.has(c.proposalId));
  const frames: SimFrame[] = [];

  for (let y = 0; y <= years; y++) {
    const metrics: SimFrame["metrics"] = {};
    const attribution: SimFrame["attribution"] = [];
    for (const b of baselines) {
      let mid = b.value, low = b.value, high = b.value;
      for (const pe of active) {
        for (const e of pe.effects) {
          if (e.metric !== b.metric) continue;
          const zone = zones.find((z) => z.id === b.zoneId);
          const inScope = e.zones === "all-in-jurisdiction" ? !!zone : e.zones.includes(b.zoneId);
          if (!inScope) continue;
          const p = progress(e, y);
          const apply = (v: number, c: number) => (e.change.kind === "pct" ? v * (1 + (c / 100) * p) : v + c * p);
          const before = mid;
          mid = apply(mid, e.change.mid);
          low = apply(low, e.change.low);
          high = apply(high, e.change.high);
          if (mid !== before) attribution.push({ proposalId: pe.proposalId, metric: b.metric, zoneId: b.zoneId, delta: mid - before });
        }
      }
      (metrics[b.zoneId] ??= {})[b.metric] = { mid, low: Math.min(low, high), high: Math.max(low, high) };
    }
    frames.push({ year: y, metrics, attribution });
  }
  return frames;
}

/* ------------------------------------------------------------------ */
/* 5. Optional: turn sim state into a Genie prompt (illustrative only) */
/* ------------------------------------------------------------------ */

export function genieprompt(zone: Zone, frame: SimFrame, describe: (m: string, v: number) => string): string {
  const m = frame.metrics[zone.id] ?? {};
  const facts = Object.entries(m).map(([k, v]) => describe(k, v.mid)).join(" ");
  return `Street-level walk through ${zone.id.replace(/_/g, " ")}, Houston, year ${frame.year} of the plan. ${facts}`;
}

/* ------------------------------------------------------------------ */
/* Examples                                                            */
/* ------------------------------------------------------------------ */

export const EXAMPLE_ZONES: Zone[] = [
  { id: "brays_bayou", kind: "watershed", jurisdiction: "Harris County", geojson: "geo/watersheds/brays.geojson" },
  { id: "greens_bayou", kind: "watershed", jurisdiction: "Harris County", geojson: "geo/watersheds/greens.geojson" },
  { id: "westheimer_corridor", kind: "corridor", jurisdiction: "Houston", geojson: "geo/corridors/westheimer.geojson" },
  { id: "gulfton_tracts", kind: "tract", jurisdiction: "Houston", geojson: "geo/tracts/gulfton.geojson" },
];

export const EXAMPLE_BASELINES: Baseline[] = [
  { metric: "structures_flooded_per_storm", zoneId: "brays_bayou", value: 4200, unit: "structures / 100-yr storm", source: "placeholder" },
  { metric: "structures_flooded_per_storm", zoneId: "greens_bayou", value: 6100, unit: "structures / 100-yr storm", source: "placeholder" },
  { metric: "corridor_travel_time", zoneId: "westheimer_corridor", value: 52, unit: "min end-to-end, peak", source: "placeholder" },
  { metric: "transit_ridership", zoneId: "westheimer_corridor", value: 18000, unit: "weekday boardings", source: "placeholder" },
  { metric: "housing_units_permitted", zoneId: "gulfton_tracts", value: 220, unit: "units / yr", source: "placeholder" },
  { metric: "median_new_home_price", zoneId: "gulfton_tracts", value: 345000, unit: "USD", source: "placeholder" },
];

export const EXAMPLE_EFFECTS: PolicyEffects[] = [
  {
    proposalId: "f_drainage",
    effects: [{
      metric: "structures_flooded_per_storm", zones: ["brays_bayou", "greens_bayou"],
      change: { kind: "pct", mid: -35, low: -20, high: -50 }, lagYears: 2, rampYears: 4,
      assumption: "Detention basins finish on schedule and upstream development doesn't add runoff.",
      evidence: "modeled",
    }],
  },
  {
    proposalId: "t_brt",
    effects: [
      { metric: "corridor_travel_time", zones: ["westheimer_corridor"],
        change: { kind: "pct", mid: -18, low: -8, high: -25 }, lagYears: 3, rampYears: 1,
        assumption: "Lanes are bus-only at peak and signals give buses priority.", evidence: "modeled" },
      { metric: "transit_ridership", zones: ["westheimer_corridor"],
        change: { kind: "pct", mid: 12, low: 4, high: 25 }, lagYears: 3, rampYears: 3,
        assumption: "Faster trips attract riders over ~3 years.", evidence: "modeled" },
    ],
  },
  {
    proposalId: "h_lots",
    effects: [
      { metric: "housing_units_permitted", zones: "all-in-jurisdiction",
        change: { kind: "pct", mid: 40, low: 10, high: 80 }, lagYears: 1, rampYears: 5,
        assumption: "Builders respond to smaller lots with townhomes where land is cheap.", evidence: "modeled" },
      { metric: "median_new_home_price", zones: "all-in-jurisdiction",
        change: { kind: "pct", mid: -6, low: 0, high: -12 }, lagYears: 2, rampYears: 5,
        assumption: "Smaller units pull the median down; demand growth may offset it.", evidence: "modeled" },
    ],
  },
];

export const EXAMPLE_BINDINGS: SceneBinding[] = [
  { metric: "structures_flooded_per_storm",
    encoding: { type: "tint-instances", layer: "buildings", flagWhen: "inFloodplain && rank < value" },
    label: "{value} homes flood in a 100-year storm (was {baseline})" },
  { metric: "corridor_travel_time",
    encoding: { type: "isochrone", origin: "westheimer_corridor", minutes: "value" },
    label: "End-to-end at rush hour: {value} min ({delta})" },
  { metric: "transit_ridership",
    encoding: { type: "vehicle-headway", layer: "routes", minutesPerVehicle: "60 * 16 / (value / 60)" },
    label: "{value} weekday riders" },
  { metric: "housing_units_permitted",
    encoding: { type: "extrude", layer: "parcels", heightPerUnit: 3 },
    label: "{value} homes permitted this year" },
];
