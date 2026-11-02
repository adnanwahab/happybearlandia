// Per-resident well-being score (0–100) used by the "well-being" overlay and Run cycle.
//
// Mood alone (the average of hunger/energy/fun/social) swings with time of day
// and drifts upward as a fresh world warms up, and plan packages barely touch it.
// So the score is day-averaged mood minus the frictions residents actually write
// journals about — long commutes, a flooded or lost home, empty shelves, dirty parks.
// Those are what plan packages change, so they're what a before/after should show.

import { COMMUTE_COMPLAINT_MINUTES, commuteBurdenMinutes, householdStress } from "./simulation-observations.js";
export const WELLBEING_METHOD={source:"analyst-assumption",empiricallyCalibrated:false,healthOutcome:false,description:"Illustrative needs score minus recorded travel, household shortfall, housing, grocery and park frictions; not measured health or happiness."};

export function moodOf(p) {
  const n = p?.needs || {};
  return (Number(n.hunger || 0) + Number(n.energy || 0) + Number(n.fun || 0) + Number(n.social || 0)) / 4;
}

// Penalties from the most recently completed day (p.yesterday) plus the 3-day total-travel average.
export function frictions(p, household = null) {
  const d = p?.yesterday || p?.today || {};
  const commute = commuteBurdenMinutes(p) ?? 0;
  return {
    commute: Math.min(25, Math.max(0, commute - COMMUTE_COMPLAINT_MINUTES * 0.5) * 0.4),
    budget: householdStress(p, household) === true ? 12 : 0,
    home: d.displaced ? 25 : d.homeFlooded ? 15 : 0,
    groceries: (Array.isArray(d.soldOutAt) && d.soldOutAt.length ? 8 : 0) + (d.emptyFridge ? 8 : 0),
    parks: Math.min(12, Number(d.dirtyParkVisits || 0) * 4),
  };
}

export function wellbeing(p, dayMood = moodOf(p), household = null) {
  const f = frictions(p, household);
  const score = dayMood - f.commute - f.budget - f.home - f.groceries - f.parks;
  return Math.max(0, Math.min(100, score));
}

// Accumulates day-averaged well-being per resident by sampling every `every` game minutes.
export function createDayMeter(n) {
  const mood = new Float64Array(n);
  let samples = 0;
  return {
    sample(people) {
      for (let i = 0; i < people.length; i++) mood[i] += moodOf(people[i]);
      samples += 1;
    },
    result(people) {
      const out = new Float64Array(people.length);
      for (let i = 0; i < people.length; i++) out[i] = wellbeing(people[i], samples ? mood[i] / samples : moodOf(people[i]));
      return out;
    },
  };
}

// Red (0) → amber (50) → green (100), as a 0xRRGGBB number.
export function wellbeingHex(score) {
  const t = Math.max(0, Math.min(1, (score - 40) / 50)); // most residents sit in 40–90
  const r = t < 0.5 ? 210 : Math.round(210 - (t - 0.5) * 2 * 150);
  const g = t < 0.5 ? Math.round(70 + t * 2 * 120) : Math.round(190 - (t - 0.5) * 2 * 30);
  const b = t < 0.5 ? 60 : Math.round(60 + (t - 0.5) * 2 * 20);
  return (r << 16) | (g << 8) | b;
}

export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
