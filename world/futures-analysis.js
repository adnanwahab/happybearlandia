// Reading an ensemble of possible futures (futures.js): how robust is the plan, what
// drives the differences, where do worlds fork, which small nudges tip them, which worlds
// are strange, and a small query language to find worlds.
//
// Everything here is computed from simulated futures. Statistical summaries (regression
// shares, divergence splits) describe this ensemble of simulated worlds under these
// assumptions; they are not claims about the real world.
//
// Pure module: browser, workers, Bun.

import { METRICS, quantile, improvementSign } from "./paired.js";
import { metricWeights } from "./multiverse.js";
import { CONDITIONS, CONDITION_KEYS, SHOCKS, SHOCK_KEYS, conditionLevel, drawsFor, normalizeAssumptions, worldPath } from "./futures.js";
import { hashSeed, rng } from "./gen.js";

const METRIC_KEYS = Object.keys(METRICS);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs) => { if (xs.length < 2) return 0; const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); };
const r3 = (x) => Math.round(x * 1000) / 1000;
const better = (k) => (METRICS[k].better === "lower" ? -1 : 1);

/* ------------------------------------------------------------------ */
/* Scores                                                              */
/* ------------------------------------------------------------------ */

/**
 * Per future, per plan, per simulated year:
 *  effect   weighted share of improvement vs the same world without the plan (≈ −1…+1;
 *           shown as %). Same scoring as multiverse.summarizeRealities.
 *  quality  how good the world with plan 0 is, against all worlds and years in this
 *           ensemble: 50 = ensemble average, ±10 per standard deviation.
 */
export function scoreFutures(futures, { needs = [], scoreBand = 0.01 } = {}) {
  const list = [...futures].sort((a, b) => a.index - b.index);
  if (!list.length) return { years: [], rows: [], plans: 0, weights: metricWeights(needs).weights, scoreBand };
  const years = list[0].simYears;
  const plans = list[0].years[years[0]].plans.length;
  const { weights, source } = metricWeights(needs);

  const scale = {};
  const qStats = {};
  for (const k of METRIC_KEYS) {
    const base = [], planVals = [];
    for (const f of list) for (const y of years) { base.push(Math.abs(f.years[y].baseline[k])); planVals.push(f.years[y].plans[0][k]); }
    scale[k] = Math.max(1, mean(base));
    qStats[k] = { mean: mean(planVals), sd: Math.max(1e-6, sd(planVals)) };
  }

  const effectOf = (b, p) => {
    let s = 0;
    for (const k of METRIC_KEYS) {
      const d = p[k] - b[k];
      s += weights[k] * improvementSign(k, d) * Math.min(1, Math.abs(d) / scale[k]);
    }
    return s;
  };
  const qualityOf = (p) => {
    let s = 0;
    for (const k of METRIC_KEYS) s += weights[k] * better(k) * (p[k] - qStats[k].mean) / qStats[k].sd;
    return 50 + 10 * s / Math.sqrt(METRIC_KEYS.reduce((a, k) => a + weights[k] ** 2, 0) || 1) / Math.sqrt(METRIC_KEYS.length);
  };

  const rows = list.map((f) => {
    const effect = Array.from({ length: plans }, (_, pi) => years.map((y) => r3(effectOf(f.years[y].baseline, f.years[y].plans[pi]))));
    const quality = years.map((y) => r3(qualityOf(f.years[y].plans[0])));
    const final = effect.map((e) => e[e.length - 1]);
    const verdict = final.map((s) => (s > scoreBand ? "improved" : s < -scoreBand ? "worse" : "mixed"));
    return { index: f.index, effect, quality, final, verdict, qualityFinal: quality[quality.length - 1] };
  });
  return { years, rows, plans, weights, weightsSource: source, scoreBand, scale, qStats };
}

/** Across how many plausible worlds does a plan work? */
export function robustness(scored, planIndex = 0) {
  const finals = scored.rows.map((r) => r.final[planIndex]);
  const n = finals.length;
  const v = scored.rows.map((r) => r.verdict[planIndex]);
  const beneficial = v.filter((x) => x === "improved").length;
  const harmful = v.filter((x) => x === "worse").length;
  return {
    n, beneficial, harmful, mixed: n - beneficial - harmful,
    robustness: n ? beneficial / n : 0,
    mean: r3(mean(finals)),
    median: r3(quantile(finals, 0.5)),
    p10: r3(quantile(finals, 0.1)),
    p90: r3(quantile(finals, 0.9)),
  };
}

/**
 * Several plans on the same worlds (same seeds, same conditions, same shocks). For each
 * world, which plan did best, and how far each plan fell short of the best (regret).
 */
export function comparePlans(scored, labels = []) {
  const P = scored.plans;
  const plans = Array.from({ length: P }, (_, pi) => ({ index: pi, label: labels[pi] || `Plan ${pi + 1}`, ...robustness(scored, pi), wins: 0, regret: [] }));
  const perWorld = scored.rows.map((r) => {
    const best = Math.max(...r.final);
    const winner = r.final.indexOf(best);
    plans[winner].wins++;
    r.final.forEach((v, pi) => plans[pi].regret.push(best - v));
    return { index: r.index, finals: r.final, winner };
  });
  for (const p of plans) {
    p.meanRegret = r3(mean(p.regret));
    p.maxRegret = r3(Math.max(0, ...p.regret));
    delete p.regret;
  }
  // Paired: in how many worlds does plan i beat plan 0?
  for (const p of plans) p.beatsFirst = perWorld.filter((w) => w.finals[p.index] > w.finals[0] + 1e-9).length;
  return { plans, perWorld };
}

/* ------------------------------------------------------------------ */
/* Features of each world (what was different about it)                */
/* ------------------------------------------------------------------ */

export const GROUPS = Object.freeze({
  events: "Random events (shocks)",
  economy: "Economic conditions",
  climate: "Climate",
  society: "Social trust",
  infrastructure: "Infrastructure",
  implementation: "Policy implementation",
});
export const RESIDUAL_LABEL = "Resident choices & chance";

export function featureDefs() {
  return [
    ...CONDITION_KEYS.map((k) => ({ id: `cond:${k}`, key: k, kind: "condition", label: CONDITIONS[k].label, group: CONDITIONS[k].group })),
    ...SHOCK_KEYS.map((k) => ({ id: `shock:${k}`, key: k, kind: "shock", label: SHOCKS[k].label, group: "events" })),
    { id: "delay", key: "delay", kind: "delay", label: "Plan start delay", group: "implementation" },
  ];
}

/** One row of features per world: average underlying conditions, shock exposure, delay. */
export function featuresOf(future, assumptions = null) {
  const a = normalizeAssumptions(assumptions || {});
  const out = {};
  for (const k of CONDITION_KEYS) out[`cond:${k}`] = mean(future.path.map((p) => conditionLevel(k, p.base[k], a)));
  for (const k of SHOCK_KEYS) out[`shock:${k}`] = future.path.reduce((s, p) => s + p.active.filter((x) => x.id === k).reduce((t, x) => t + x.weight * x.magnitude, 0), 0);
  out.delay = future.delay;
  return out;
}

/* ------------------------------------------------------------------ */
/* Ridge regression on standardized features                           */
/* ------------------------------------------------------------------ */

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

function fitStd(Z, y, cols, lambda = 1) {
  const n = y.length;
  const ym = mean(y);
  const yc = y.map((v) => v - ym);
  const sst = yc.reduce((s, v) => s + v * v, 0) || 1e-12;
  if (!cols.length) return { coef: [], r2: 0, sst };
  const p = cols.length;
  const A = Array.from({ length: p }, () => new Array(p).fill(0));
  const b = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      const za = Z[cols[a]][i];
      b[a] += za * yc[i];
      for (let c = a; c < p; c++) A[a][c] += za * Z[cols[c]][i];
    }
  }
  for (let a = 0; a < p; a++) { A[a][a] += lambda; for (let c = 0; c < a; c++) A[a][c] = A[c][a]; }
  const coef = solve(A, b);
  let sse = 0;
  for (let i = 0; i < n; i++) {
    let yh = 0;
    for (let a = 0; a < p; a++) yh += coef[a] * Z[cols[a]][i];
    sse += (yc[i] - yh) ** 2;
  }
  return { coef, r2: Math.max(0, 1 - sse / sst), sst };
}

/**
 * Fit target ~ features. Returns a model (predict) plus how much each feature and each
 * group of features accounts for (Shapley shares of R², so shares add up and don't depend
 * on the order features are listed). What's left is RESIDUAL_LABEL: in this simulator
 * that is mostly residents' own random choices and interactions.
 */
export function explainVariance(futures, target, { assumptions = null, permutations = 120, lambda = 1 } = {}) {
  const defs = featureDefs();
  const X = futures.map((f) => featuresOf(f, assumptions));
  const n = futures.length;
  const stats = defs.map((d) => { const v = X.map((x) => x[d.id]); return { mean: mean(v), sd: sd(v), q10: quantile(v, 0.1), q90: quantile(v, 0.9) }; });
  const usable = defs.map((d, i) => i).filter((i) => stats[i].sd > 1e-9);
  const Z = defs.map((d, i) => X.map((x) => (stats[i].sd > 1e-9 ? (x[d.id] - stats[i].mean) / stats[i].sd : 0)));
  const ty = target.map(Number);
  const full = fitStd(Z, ty, usable, lambda);
  const p = usable.length;
  const adj = n - p - 1 > 0 ? Math.max(0, 1 - (1 - full.r2) * (n - 1) / (n - p - 1)) : full.r2;

  // Feature Shapley (sampled permutations, deterministic).
  const r = rng(hashSeed(`shapley:${n}:${p}`));
  const cache = new Map();
  const r2Of = (cols) => {
    const key = [...cols].sort((a, b) => a - b).join(",");
    if (!cache.has(key)) cache.set(key, fitStd(Z, ty, cols, lambda).r2);
    return cache.get(key);
  };
  const shap = new Map(usable.map((i) => [i, 0]));
  const perms = n > 4 && p ? permutations : 0;
  for (let t = 0; t < perms; t++) {
    const order = [...usable];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const cols = [];
    let prev = 0;
    for (const c of order) { cols.push(c); const now = r2Of(cols); shap.set(c, shap.get(c) + (now - prev)); prev = now; }
  }
  const scaleTo = full.r2 > 0 ? adj / full.r2 : 0;
  const features = defs.map((d, i) => {
    const s = perms ? (shap.get(i) || 0) / perms : 0;
    const k = usable.indexOf(i);
    const coefStd = k >= 0 ? full.coef[k] : 0;
    const coefRaw = k >= 0 && stats[i].sd > 0 ? coefStd / stats[i].sd : 0;
    return { ...d, share: Math.max(0, s * scaleTo), direction: Math.sign(coefStd), swing: r3(coefRaw * (stats[i].q90 - stats[i].q10)), coefRaw, mean: stats[i].mean, sd: stats[i].sd };
  }).sort((a, b) => b.share - a.share);

  // Group Shapley (exact).
  const groupIds = Object.keys(GROUPS).filter((g) => usable.some((i) => defs[i].group === g));
  const colsOf = (gs) => usable.filter((i) => gs.includes(defs[i].group));
  const G = groupIds.length;
  const fact = (k) => (k <= 1 ? 1 : k * fact(k - 1));
  const groups = groupIds.map((g) => {
    let s = 0;
    const others = groupIds.filter((x) => x !== g);
    for (let mask = 0; mask < 1 << others.length; mask++) {
      const S = others.filter((_, i) => mask & (1 << i));
      const w = (fact(S.length) * fact(G - S.length - 1)) / fact(G);
      s += w * (r2Of(colsOf([...S, g])) - r2Of(colsOf(S)));
    }
    return { id: g, label: GROUPS[g], share: Math.max(0, s * scaleTo) };
  }).sort((a, b) => b.share - a.share);

  const predict = (row) => {
    let y = mean(ty);
    usable.forEach((i, k) => { y += full.coef[k] * ((row[defs[i].id] - stats[i].mean) / stats[i].sd); });
    return y;
  };
  const residuals = futures.map((f, i) => ty[i] - predict(X[i]));
  return { n, r2: r3(full.r2), adjR2: r3(adj), residual: r3(1 - adj), features, groups, predict, residualSd: sd(residuals), residuals, X };
}

/* ------------------------------------------------------------------ */
/* Divergence: where do worlds fork?                                   */
/* ------------------------------------------------------------------ */

function hitBy(future, id, year) {
  return future.path.some((p) => p.year <= year && p.started.includes(id));
}

/**
 * A tree of forks in history. Starting from all worlds, repeatedly find the earliest-
 * explaining split — a condition being high or low in some year, or a shock having hit by
 * some year — that best separates how worlds ended up. Children can only split at the same
 * year or later, so reading left to right is reading forward in time.
 */
export function divergenceTree(futures, scored, { target = "effect", planIndex = 0, maxDepth = 3, assumptions = null } = {}) {
  const byIndex = new Map(futures.map((f) => [f.index, f]));
  const rows = scored.rows.filter((r) => byIndex.has(r.index));
  const n = rows.length;
  const yOf = (r) => (target === "quality" ? r.qualityFinal : r.final[planIndex] * 100);
  const trajOf = (r) => (target === "quality" ? r.quality : r.effect[planIndex].map((v) => v * 100));
  const a = normalizeAssumptions(assumptions || {});
  const minLeaf = Math.max(4, Math.ceil(n * 0.08));
  const vals = rows.map(yOf);
  const rootSS = vals.reduce((s, v) => s + (v - mean(vals)) ** 2, 0) || 1e-9;
  const maxYear = futures[0]?.path.length || 1;
  let nextId = 0;

  const ss = (xs) => { const m = mean(xs); return xs.reduce((s, v) => s + (v - m) ** 2, 0); };

  function candidates(idx, fromYear) {
    const out = [];
    for (let y = fromYear; y <= maxYear; y++) {
      for (const k of CONDITION_KEYS) {
        const v = idx.map((i) => conditionLevel(k, byIndex.get(rows[i].index).path[y - 1].base[k], a));
        for (const q of [0.33, 0.5, 0.67]) {
          const t = quantile(v, q);
          const hi = idx.filter((_, j) => v[j] > t);
          out.push({ year: y, kind: "condition", key: k, threshold: t, hi });
        }
      }
      for (const k of SHOCK_KEYS) {
        const hi = idx.filter((i) => hitBy(byIndex.get(rows[i].index), k, y));
        out.push({ year: y, kind: "shock", key: k, hi });
      }
    }
    for (const d of [1, 2]) out.push({ year: 1, kind: "delay", key: "delay", threshold: d, hi: idx.filter((i) => byIndex.get(rows[i].index).delay >= d) });
    return out;
  }

  function label(c) {
    if (c.kind === "condition") {
      const L = CONDITIONS[c.key].label.toLowerCase();
      return { hi: `higher ${L}`, lo: `lower ${L}`, what: `${CONDITIONS[c.key].label} in year ${c.year}` };
    }
    if (c.kind === "shock") return { hi: `${SHOCKS[c.key].label.toLowerCase()} by year ${c.year}`, lo: `no ${SHOCKS[c.key].label.toLowerCase()} by year ${c.year}`, what: `${SHOCKS[c.key].label} by year ${c.year}` };
    return { hi: `plan started ≥${c.threshold} yr late`, lo: c.threshold === 1 ? "plan started on time" : `plan started <${c.threshold} yr late`, what: "Plan start" };
  }

  function node(idx, depth, fromYear) {
    const ys = idx.map((i) => vals[i]);
    const trajs = idx.map((i) => trajOf(rows[i]));
    const traj = scored.years.map((_, yi) => r3(mean(trajs.map((t) => t[yi]))));
    const nd = { id: nextId++, n: idx.length, indices: idx.map((i) => rows[i].index), mean: r3(mean(ys)), sd: r3(sd(ys)), traj, startYear: fromYear, split: null, children: [] };
    if (depth >= maxDepth || idx.length < 2 * minLeaf) return nd;
    const parentSS = ss(ys);
    let best = null;
    for (const c of candidates(idx, fromYear)) {
      const hiSet = new Set(c.hi);
      const lo = idx.filter((i) => !hiSet.has(i));
      if (c.hi.length < minLeaf || lo.length < minLeaf) continue;
      const gain = parentSS - ss(c.hi.map((i) => vals[i])) - ss(lo.map((i) => vals[i]));
      // Prefer earlier forks when gains are close: history is read forward.
      const g = gain * (1 - 0.01 * (c.year - fromYear));
      if (!best || g > best.g) best = { ...c, lo, gain, g };
    }
    if (!best || best.gain < 0.04 * rootSS) return nd;
    const L = label(best);
    const hiNode = node(best.hi, depth + 1, best.year);
    const loNode = node(best.lo, depth + 1, best.year);
    hiNode.branch = L.hi; loNode.branch = L.lo;
    // When do the two groups visibly separate? First simulated year their averages differ
    // by more than a quarter of the spread.
    const spread = Math.max(1e-6, sd(idx.map((i) => vals[i])));
    const sepYi = scored.years.findIndex((_, yi) => Math.abs(hiNode.traj[yi] - loNode.traj[yi]) > 0.25 * spread);
    const unit = target === "quality" ? " pts" : "%";
    const f = (x) => (target === "quality" ? `${x.toFixed(1)}${unit} of world quality` : `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(1)}${unit}`);
    nd.split = {
      year: best.year, kind: best.kind, key: best.key, threshold: best.threshold != null ? r3(best.threshold) : null,
      what: L.what, explained: r3(best.gain / rootSS),
      visibleYear: sepYi >= 0 ? scored.years[sepYi] : null,
      text: `Year ${best.year}: worlds with ${L.hi} (${hiNode.n}) ended at ${f(hiNode.mean)} on average; worlds with ${L.lo} (${loNode.n}) ended at ${f(loNode.mean)}.`,
    };
    nd.children = [hiNode, loNode];
    return nd;
  }

  return { target, unit: target === "quality" ? "pts" : "%", root: n ? node(rows.map((_, i) => i), 0, 1) : null, years: scored.years, maxYear };
}

/* ------------------------------------------------------------------ */
/* Butterfly points: tiny nudges that tip later history                */
/* ------------------------------------------------------------------ */

const shockList = (path, fromYear) => path.years.flatMap((p) => (p.year >= fromYear ? p.started.map((id) => ({ id, year: p.year })) : []));

/**
 * For every world, year and condition, nudge the condition by `nudge` (share of its
 * starting range) from that year on and recompute the world's path. Most nudges change
 * nothing but the nudge itself; some flip which shocks happen later (a cascade). Those
 * are critical junctures. Their consequence is first estimated with the variance model
 * (cheap), and can then be checked by actually simulating the branch.
 */
export function butterflyPoints(futures, model, { assumptions = null, years = null, nudge = 0.03, top = 8 } = {}) {
  const a = normalizeAssumptions(assumptions || {});
  const out = [];
  const byYear = {};
  let tried = 0;
  for (const f of futures) {
    const N = years || f.path.length;
    const draws = drawsFor(f.seed, N);
    const orig = worldPath(f.seed, N, a, f.override || null, draws);
    const before = model.predict(featuresOf({ path: orig.years, delay: orig.delay }, a));
    for (let y = 1; y < N; y++) {
      for (const k of CONDITION_KEYS) {
        const [lo, hi] = a.ranges[k];
        const step = nudge * (hi - lo || 1);
        for (const dir of [-1, 1]) {
          tried++;
          const from = orig.years[y - 1].base[k];
          const to = from + dir * step;
          const alt = worldPath(f.seed, N, a, { fromYear: y, set: { [k]: to } }, draws);
          const s0 = shockList(orig, y), s1 = shockList(alt, y);
          const key = (s) => s.map((x) => `${x.id}@${x.year}`).join(",");
          if (key(s0) === key(s1)) continue;
          byYear[y] = (byYear[y] || 0) + 1;
          const after = model.predict(featuresOf({ path: alt.years, delay: alt.delay }, a));
          const gone = s0.filter((x) => !s1.some((z) => z.id === x.id && z.year === x.year));
          const added = s1.filter((x) => !s0.some((z) => z.id === x.id && z.year === x.year));
          out.push({ index: f.index, year: y, key: k, from: r3(from), to: r3(to), nudge: dir * nudge, predicted: { before: r3(before), after: r3(after), change: r3(after - before) }, gone, added });
        }
      }
    }
  }
  // Keep the most consequential juncture per world.
  out.sort((x, y) => Math.abs(y.predicted.change) - Math.abs(x.predicted.change));
  const seen = new Set();
  const best = [];
  for (const b of out) { if (seen.has(b.index)) continue; seen.add(b.index); best.push(b); if (best.length >= top) break; }
  return { tried, tipping: out.length, top: best, byYear };
}

export function describeEventChange(b) {
  const nm = (x) => `${SHOCKS[x.id].label.toLowerCase()} in year ${x.year}`;
  const parts = [];
  if (b.gone.length) parts.push(`no ${b.gone.map(nm).join(", no ")}`);
  if (b.added.length) parts.push(`${b.added.map(nm).join(", ")} happens instead`);
  return parts.join("; ");
}

/* ------------------------------------------------------------------ */
/* Weird worlds                                                        */
/* ------------------------------------------------------------------ */

function gammaP(s, x) {
  // Regularized lower incomplete gamma P(s, x).
  if (x <= 0) return 0;
  const lg = lnGamma(s);
  if (x < s + 1) {
    let sum = 1 / s, term = sum;
    for (let n = 1; n < 200; n++) { term *= x / (s + n); sum += term; if (term < sum * 1e-12) break; }
    return sum * Math.exp(-x + s * Math.log(x) - lg);
  }
  let b = x + 1 - s, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return 1 - Math.exp(-x + s * Math.log(x) - lg) * h;
}

function lnGamma(z) {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * How unusual is each world? Its final outcomes (with the plan, and the plan's effect on
 * each) are turned into z-scores against the ensemble; rarity is the chance a typical
 * world would be at least this far from average (chi-square on the z-scores). Surprise is
 * how far the world's plan effect is from what its conditions predict.
 */
export function weirdWorlds(futures, scored, model = null, { top = 5 } = {}) {
  const byIndex = new Map(futures.map((f) => [f.index, f]));
  const last = scored.years[scored.years.length - 1];
  const dims = [
    ...METRIC_KEYS.map((k) => ({ id: `world:${k}`, label: METRICS[k].label, unit: METRICS[k].unit, get: (f) => f.years[last].plans[0][k] })),
    ...METRIC_KEYS.map((k) => ({ id: `effect:${k}`, label: `Plan's effect on ${METRICS[k].label.toLowerCase()}`, unit: METRICS[k].unit, get: (f) => f.years[last].plans[0][k] - f.years[last].baseline[k] })),
  ];
  const rows = scored.rows.filter((r) => byIndex.has(r.index));
  const M = dims.map((d) => rows.map((r) => d.get(byIndex.get(r.index))));
  const st = M.map((v) => ({ mean: mean(v), sd: sd(v), median: quantile(v, 0.5) }));
  const live = dims.map((_, j) => j).filter((j) => st[j].sd > 1e-9);
  const out = rows.map((r, i) => {
    const z = live.map((j) => ({ j, z: (M[j][i] - st[j].mean) / st[j].sd }));
    const chi = z.reduce((s, x) => s + x.z * x.z, 0);
    const rarity = live.length ? 1 - gammaP(live.length / 2, chi / 2) : 1;
    const traits = z.filter((x) => Math.abs(x.z) >= 1.5).sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 6)
      .map((x) => ({ id: dims[x.j].id, label: dims[x.j].label, unit: dims[x.j].unit, value: r3(M[x.j][i]), typical: r3(st[x.j].median), z: r3(x.z) }));
    const k = model ? futures.findIndex((f) => f.index === r.index) : -1;
    const surprise = model && k >= 0 && model.residualSd > 1e-9 ? r3(model.residuals[k] / model.residualSd) : null;
    return { index: r.index, chi: r3(chi), rarity, traits, surprise, final: r.final[0], quality: r.qualityFinal };
  });
  out.sort((a, b) => a.rarity - b.rarity || b.chi - a.chi);
  return { dims: live.length, worlds: out.slice(0, top), all: out };
}

/* ------------------------------------------------------------------ */
/* Search: "worlds where well-being rises but walking gets worse"      */
/* ------------------------------------------------------------------ */

const METRIC_ALIASES = [
  [/well[- ]?being|mood|happiness|happy|wellbeing/, "avgMood"],
  [/long commutes?|commuters/, "overWalkComplaint"],
  [/walk(ing)?( time)?|commute|travel time|trips?/, "avgWalkMinutes"],
  [/displace(d|ment)?|flood(ing|s)?|storm damage/, "displacedResidents"],
  [/sold[- ]?out|shortages?|empty shelves|shops?/, "soldOutEvents"],
  [/litter|trash|dirty parks?|parks?/, "avgParkLitter"],
];
const COND_ALIASES = [
  [/econom(y|ic)|wages?|prosperity|gdp|income/, "economy"],
  [/supply( chains?)?|deliveries|restocking/, "supply"],
  [/climate|storms?(?! damage)/, "climate"],
  [/trust|civic|community/, "trust"],
  [/streets?|traffic|roads?|mobility|infrastructure/, "mobility"],
  [/delivery|implementation|adoption|enforcement|execution/, "delivery"],
];
const SHOCK_ALIASES = [
  [/recessions?|downturns?|depressions?/, "recession"],
  [/booms?/, "boom"],
  [/hurricanes?|big storms?/, "hurricane"],
  [/supply shocks?/, "supplyShock"],
  [/infrastructure failures?|breakdowns?|outages?/, "infrastructure"],
  [/turnover|elections?|new government/, "turnover"],
  [/movements?|civic surge|organizing/, "movement"],
  [/pandemics?|epidemics?/, "pandemic"],
  [/unrest|protests?|riots?/, "unrest"],
];
const UP = /\b(rises?|rising|rose|up|increases?|increasing|grows?|growing|higher|goes up|climbs?|more|raises?|boosts?)\b/;
const DOWN = /\b(falls?|falling|fell|drops?|dropping|down|decreases?|decreasing|declines?|declining|lowers?|shrinks?|less|fewer|reduces?|cuts?)\b/;
const BETTER = /\b(improves?|improving|improved|better|gets better)\b/;
const WORSE = /\b(worsens?|worsening|worse|gets worse|deteriorates?)\b/;

function findAlias(text, table) {
  for (const [re, id] of table) if (re.test(text)) return id;
  return null;
}

function parseAmount(text) {
  const m = text.match(/(>=|<=|>|<|more than|less than|over|under|at least|at most|above|below|by)?\s*(-?\d+(?:\.\d+)?)\s*(%|percent|pts?|points?|min(?:utes)?|people)?/);
  if (!m || m[2] == null) return null;
  const word = (m[1] || "").trim();
  const op = /<|less|under|at most|below/.test(word) ? "<" : ">";
  return { op, value: Number(m[2]), pct: /%|percent/.test(m[3] || "") };
}

/**
 * Parse a plain-English query into clauses (ANDed). Returns { clauses, unknown }: each
 * clause has a human `label` so the page can show what it understood.
 */
export function parseQuery(q) {
  const text = String(q || "").toLowerCase().replace(/[“”"']/g, "").trim();
  const cleaned = text.replace(/^(show( me)?|find|list|which|what|give me)\s+/, "").replace(/\b(the )?(possible )?(worlds?|realities|reality|futures?)( where| in which| that| with)?\b/g, " ");
  const phrases = cleaned.split(/\b(?:and|but|despite|while|though|although|yet|whereas|even though|where)\b|,|;|\+/).map((s) => s.trim()).filter(Boolean);
  const clauses = [], unknown = [];
  for (const raw of phrases) {
    const ph = raw.replace(/\s+/g, " ").trim();
    const neg = /\b(no|not|without|never|didn'?t|doesn'?t|zero)\b/.test(ph);
    const yearM = ph.match(/\b(in|by|before|after|during|from)? ?year (\d+)\b/);
    const year = yearM ? { op: yearM[1] || "in", year: Number(yearM[2]) } : null;
    const amount = parseAmount(ph.replace(/year \d+/, ""));

    const shock = findAlias(ph, SHOCK_ALIASES);
    if (shock) {
      const recovery = /recover/.test(ph);
      clauses.push({ type: "shock", id: shock, negate: neg && !recovery, year, recovery, label: `${neg && !recovery ? "no " : ""}${SHOCKS[shock].label.toLowerCase()}${year ? ` ${year.op} year ${year.year}` : ""}${recovery ? ", then the world recovers" : ""}` });
      continue;
    }
    if (/\b(delay(ed)?|late start|started late|on time)\b/.test(ph)) {
      const onTime = /on time|no delay|not delayed/.test(ph) || neg;
      clauses.push({ type: "delay", late: !onTime, label: onTime ? "plan starts on time" : "plan starts late" });
      continue;
    }
    // "low adoption still succeeds": a verdict and a condition in one phrase.
    const condInVerdict = () => {
      const k = findAlias(ph, COND_ALIASES);
      const level = /\b(high|strong|good|robust|great|full)\b/.test(ph) ? "high" : /\b(low|weak|bad|poor|failing|partial)\b/.test(ph) ? "low" : null;
      if (k && level) clauses.push({ type: "cond", key: k, level, label: `${level} ${CONDITIONS[k].label.toLowerCase()} (average over the years)` });
    };
    if (/\b(plan|policy|it)\b.*\b(fails?|failed|backfires?|hurts|harmful|harms)\b|\b(fails?|backfires?|harmful)\b/.test(ph) && !findAlias(ph, METRIC_ALIASES)) {
      condInVerdict();
      clauses.push({ type: "verdict", verdict: "worse", label: "plan makes things worse" }); continue;
    }
    if (/\b(plan|policy|it)\b.*\b(succeeds?|works?|helps|beneficial|improves things)\b|\b(succeeds?|beneficial)\b/.test(ph) && !findAlias(ph, METRIC_ALIASES)) {
      condInVerdict();
      clauses.push({ type: "verdict", verdict: "improved", label: "plan improves things" }); continue;
    }
    if (/\bmixed|no (clear )?effect|about the same\b/.test(ph)) { clauses.push({ type: "verdict", verdict: "mixed", label: "plan's effect is mixed" }); continue; }
    if (/\b(score|effect)\b/.test(ph) && amount) {
      clauses.push({ type: "effect", op: amount.op, value: amount.value, label: `plan score ${amount.op} ${amount.value}%` }); continue;
    }
    if (/\bquality\b/.test(ph)) {
      const dir = UP.test(ph) || /\bhigh|good|best\b/.test(ph) ? "high" : "low";
      clauses.push({ type: "quality", dir, label: `world quality ${dir === "high" ? "above" : "below"} average` }); continue;
    }

    const metric = findAlias(ph, METRIC_ALIASES);
    const cond = !metric ? findAlias(ph, COND_ALIASES) : null;
    const dir = BETTER.test(ph) ? "better" : WORSE.test(ph) ? "worse" : UP.test(ph) ? "up" : DOWN.test(ph) ? "down" : null;

    if (cond) {
      const level = /\b(high|strong|good|robust|great|full)\b/.test(ph) ? "high" : /\b(low|weak|bad|poor|failing|partial)\b/.test(ph) ? "low" : null;
      if (level) { clauses.push({ type: "cond", key: cond, level, label: `${level} ${CONDITIONS[cond].label.toLowerCase()} (average over the years)` }); continue; }
      if (dir === "up" || dir === "down" || dir === "better" || dir === "worse") {
        const d = dir === "better" ? "up" : dir === "worse" ? "down" : dir;
        clauses.push({ type: "condTrend", key: cond, dir: d, label: `${CONDITIONS[cond].label.toLowerCase()} ${d === "up" ? "rises" : "falls"} from year 1 to the end` }); continue;
      }
      unknown.push(raw); continue;
    }
    if (metric) {
      const scope = /\b(plan|policy|because of|vs|versus|than without|effect)\b/.test(ph) ? "plan" : "time";
      let d = dir;
      if (d === "better") d = better(metric) > 0 ? "up" : "down";
      if (d === "worse") d = better(metric) > 0 ? "down" : "up";
      if (!d) { unknown.push(raw); continue; }
      const amt = amount && !year ? amount : null;
      const nm = METRICS[metric].label.toLowerCase();
      const label = scope === "plan"
        ? `the plan ${d === "up" ? "raises" : "lowers"} ${nm}${amt ? ` by ${amt.op === "<" ? "less than" : "more than"} ${amt.value}${amt.pct ? "%" : ` ${METRICS[metric].unit}`}` : ""}`
        : `${nm} ${d === "up" ? "rises" : "falls"} over the years${amt ? ` by ${amt.op === "<" ? "less than" : "more than"} ${amt.value}${amt.pct ? "%" : ` ${METRICS[metric].unit}`}` : ""}`;
      clauses.push({ type: "metric", key: metric, scope, dir: d, amount: amt, label });
      continue;
    }
    if (/\b(inequality|gdp per|crime|rent|housing price|homeless)/.test(ph)) { unknown.push(`${raw} (not modeled yet)`); continue; }
    if (/^(show|me|all|any|some|the|a)$/.test(ph)) continue;
    unknown.push(raw);
  }
  return { clauses, unknown };
}

function matchClause(c, f, row, ctx) {
  const last = f.simYears[f.simYears.length - 1], first = f.simYears[0];
  switch (c.type) {
    case "verdict": return row.verdict[ctx.planIndex] === c.verdict;
    case "effect": return c.op === "<" ? row.final[ctx.planIndex] * 100 < c.value : row.final[ctx.planIndex] * 100 > c.value;
    case "quality": return c.dir === "high" ? row.qualityFinal > 50 : row.qualityFinal < 50;
    case "delay": return c.late ? f.delay > 0 : f.delay === 0;
    case "cond": {
      const lvl = mean(f.path.map((p) => conditionLevel(c.key, p.eff[c.key], ctx.assumptions)));
      return c.level === "high" ? lvl > 0.6 : lvl < 0.4;
    }
    case "condTrend": {
      const d = f.path[f.path.length - 1].eff[c.key] - f.path[0].eff[c.key];
      return c.dir === "up" ? d > 0 : d < 0;
    }
    case "shock": {
      const yrs = f.path.filter((p) => p.started.includes(c.id)).map((p) => p.year);
      const ok = yrs.filter((y) => !c.year || (c.year.op === "by" || c.year.op === "before" ? (c.year.op === "before" ? y < c.year.year : y <= c.year.year) : c.year.op === "after" || c.year.op === "from" ? y >= c.year.year : y === c.year.year));
      if (c.negate) return ok.length === 0;
      if (!ok.length) return false;
      if (!c.recovery) return true;
      // Recovery: the world (with the plan) ends better than it was in the worst year of the shock.
      const y0 = ok[0];
      const yi = f.simYears.map((y, i) => [y, i]).filter(([y]) => y >= y0 && y <= y0 + SHOCKS[c.id].duration);
      if (!yi.length) return false;
      const low = Math.min(...yi.map(([, i]) => row.quality[i]));
      return row.qualityFinal - low >= 3;
    }
    case "metric": {
      const pick = (y, plan) => (plan ? f.years[y].plans[ctx.planIndex][c.key] : f.years[y].baseline[c.key]);
      const from = c.scope === "plan" ? pick(last, false) : pick(first, true);
      const to = pick(last, true);
      const d = to - from;
      if (c.dir === "up" ? !(d > 1e-9) : !(d < -1e-9)) return false;
      if (!c.amount) return true;
      const size = c.amount.pct ? (Math.abs(d) / Math.max(1e-9, Math.abs(from))) * 100 : Math.abs(d);
      return c.amount.op === "<" ? size < c.amount.value : size > c.amount.value;
    }
    default: return true;
  }
}

export function searchFutures(query, futures, scored, { assumptions = null, planIndex = 0 } = {}) {
  const parsed = parseQuery(query);
  const ctx = { assumptions: normalizeAssumptions(assumptions || {}), planIndex };
  const rows = new Map(scored.rows.map((r) => [r.index, r]));
  const matches = futures.filter((f) => rows.has(f.index) && parsed.clauses.every((c) => matchClause(c, f, rows.get(f.index), ctx))).map((f) => f.index);
  return { ...parsed, matches };
}

export const EXAMPLE_QUERIES = [
  "well-being rises but walking gets worse",
  "plan fails despite high delivery",
  "plan succeeds with low delivery",
  "recession followed by recovery",
  "hurricane by year 3 and plan lowers displaced",
  "low trust and park litter rises",
  "economy falls but well-being rises",
  "plan started late and plan succeeds",
];

/* ------------------------------------------------------------------ */
/* Stories: a year in a world, and a resident's life                   */
/* ------------------------------------------------------------------ */

export function yearStory(future, year, assumptions = null) {
  const a = normalizeAssumptions(assumptions || {});
  const p = future.path[year - 1];
  if (!p) return [];
  const lines = [];
  for (const id of p.started) lines.push({ kind: "shock", id, text: `${SHOCKS[id].icon} ${SHOCKS[id].label} begins` });
  for (const s of p.active) if (!p.started.includes(s.id)) lines.push({ kind: "ongoing", id: s.id, text: `${SHOCKS[s.id].icon} ${SHOCKS[s.id].label} continues (${Math.round(s.weight * 100)}% strength)` });
  if (year === future.delay + 1 && future.delay > 0) lines.push({ kind: "plan", text: `🗓 The plan finally starts, ${future.delay} year${future.delay > 1 ? "s" : ""} late` });
  if (year === 1 && future.delay === 0) lines.push({ kind: "plan", text: "🗓 The plan starts" });
  for (const k of CONDITION_KEYS) {
    const lvl = conditionLevel(k, p.eff[k], a);
    if (lvl > 0.9) lines.push({ kind: "condition", key: k, text: `${CONDITIONS[k].label} unusually strong (${CONDITIONS[k].fmt(p.eff[k])})` });
    else if (lvl < 0.1) lines.push({ kind: "condition", key: k, text: `${CONDITIONS[k].label} unusually weak (${CONDITIONS[k].fmt(p.eff[k])})` });
  }
  return lines;
}

const P_FIELDS = ["walkMinutesPerDay", "mood", "money", "emptyFridgeDays", "soldOutHits", "dirtyParkVisits"];

/**
 * Every resident's life across the simulated years of one world, with the plan and
 * without it (the same person, same dice). Each simulated year is one week; the town
 * starts fresh each year, so a move after a flood doesn't carry over to the next year.
 */
export function buildLives(future, { planIndex = 0 } = {}) {
  const ys = future.simYears.filter((y) => future.people?.[y]);
  if (!ys.length) return [];
  const first = future.people[ys[0]].plans[planIndex] || future.people[ys[0]].baseline;
  return first.map((p0, i) => {
    const years = ys.map((y) => {
      const plan = future.people[y].plans[planIndex]?.[i] || future.people[y].baseline[i];
      const base = future.people[y].baseline[i];
      const pick = (o) => Object.fromEntries([...P_FIELDS.map((k) => [k, r3(Number(o?.[k] || 0))]), ["displaced", !!o?.displaced]]);
      return { year: y, age: p0.age + y, plan: pick(plan), base: pick(base) };
    });
    return { id: p0.id, name: p0.name, age: p0.age, trait: p0.trait, worker: p0.worker, student: p0.student, years, events: lifeEvents(future, years, p0) };
  });
}

function lifeEvents(future, years, person) {
  const ev = [];
  let prev = null;
  for (const y of years) {
    const p = y.plan, b = y.base;
    const at = (text, tone = "", kind = "life") => ev.push({ year: y.year, age: y.age, text, tone, kind });
    const path = future.path[y.year - 1];
    for (const id of path?.started || []) {
      if (id === "recession" && person.worker) at(`Recession: pay and savings shrink`, "bad", "world");
      else if (id === "hurricane") at(`Hurricane season`, "bad", "world");
      else if (id === "supplyShock") at(`Supply shock: shelves empty out faster`, "bad", "world");
      else if (id === "boom" && person.worker) at(`Boom: pay rises`, "good", "world");
    }
    if (y.year === future.delay + 1) at(future.delay ? `The plan finally reaches the neighborhood (${future.delay} yr late)` : "The plan starts", "", "world");
    if (p.displaced && !b.displaced) at("The storm floods their home and they move in with neighbors — without the plan they'd have stayed dry", "bad");
    else if (p.displaced) at("The storm floods their home; they move in with neighbors for the week", "bad");
    else if (b.displaced) at("Their street floods in the no-plan world, but with the plan their home stays dry", "good");
    const walkSaved = b.walkMinutesPerDay - p.walkMinutesPerDay;
    if (Math.abs(walkSaved) >= 5) at(walkSaved > 0 ? `The plan saves them ${Math.round(walkSaved)} min of walking a day (${Math.round(p.walkMinutesPerDay)} vs ${Math.round(b.walkMinutesPerDay)})` : `They walk ${Math.round(-walkSaved)} min a day more than without the plan`, walkSaved > 0 ? "good" : "bad");
    if (prev && Math.abs(p.walkMinutesPerDay - prev.walkMinutesPerDay) >= Math.max(6, prev.walkMinutesPerDay * 0.25)) at(`Daily walking ${p.walkMinutesPerDay > prev.walkMinutesPerDay ? "rises" : "falls"} to ${Math.round(p.walkMinutesPerDay)} min (from ${Math.round(prev.walkMinutesPerDay)})`, p.walkMinutesPerDay > prev.walkMinutesPerDay ? "bad" : "good");
    if (p.emptyFridgeDays >= 2) at(`Runs out of food at home on ${p.emptyFridgeDays} days${b.emptyFridgeDays > p.emptyFridgeDays ? ` (${b.emptyFridgeDays} without the plan)` : ""}`, "bad");
    else if (b.emptyFridgeDays >= 2 && p.emptyFridgeDays < b.emptyFridgeDays) at(`Keeps food at home — without the plan they'd have run out on ${b.emptyFridgeDays} days`, "good");
    if (p.money < 40 && (person.worker || person.age + y.year >= 18)) at(`Money runs tight: $${Math.round(p.money)} by week's end`, "bad");
    if (p.money - b.money >= 20) at(`Ends the week $${Math.round(p.money - b.money)} better off than without the plan`, "good");
    if (b.money - p.money >= 20) at(`Ends the week $${Math.round(b.money - p.money)} worse off than without the plan`, "bad");
    if (prev && Math.abs(p.mood - prev.mood) >= 6) at(`Mood ${p.mood > prev.mood ? "lifts" : "sinks"} to ${Math.round(p.mood)} (from ${Math.round(prev.mood)})`, p.mood > prev.mood ? "good" : "bad");
    if (p.dirtyParkVisits >= 2) at(`Finds the park trashed ${p.dirtyParkVisits} times`, "bad");
    prev = p;
  }
  return ev;
}

/** One number per resident: how much the plan changed their life over all years. */
export function lifeImpact(life) {
  let s = 0;
  for (const y of life.years) {
    s += (y.base.walkMinutesPerDay - y.plan.walkMinutesPerDay) / 10 + (y.plan.mood - y.base.mood) / 2
      + (y.base.displaced && !y.plan.displaced ? 3 : 0) - (y.plan.displaced && !y.base.displaced ? 3 : 0)
      - (y.plan.emptyFridgeDays - y.base.emptyFridgeDays);
  }
  return r3(s);
}

/** Score one extra future (a branch or twin) on the ensemble's scale. */
export function scoreOne(scored, future, planIndex = 0) {
  const w = scored.weights;
  const norm = Math.sqrt(METRIC_KEYS.reduce((a, k) => a + w[k] ** 2, 0) || 1) * Math.sqrt(METRIC_KEYS.length);
  const ys = future.simYears;
  const effect = ys.map((y) => {
    const b = future.years[y].baseline, p = future.years[y].plans[planIndex] || b;
    let s = 0;
    for (const k of METRIC_KEYS) { const d = p[k] - b[k]; s += w[k] * improvementSign(k, d) * Math.min(1, Math.abs(d) / (scored.scale?.[k] || 1)); }
    return r3(s);
  });
  const quality = ys.map((y) => {
    const p = future.years[y].plans[planIndex] || future.years[y].baseline;
    let s = 0;
    for (const k of METRIC_KEYS) s += w[k] * better(k) * (p[k] - scored.qStats[k].mean) / scored.qStats[k].sd;
    return r3(50 + 10 * s / norm);
  });
  const final = effect[effect.length - 1];
  return { years: ys, effect, quality, final, qualityFinal: quality[quality.length - 1], verdict: final > scored.scoreBand ? "improved" : final < -scored.scoreBand ? "worse" : "mixed" };
}
