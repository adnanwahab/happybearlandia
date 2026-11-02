import { addIntervention } from "../city/engine.js";
import { validateState, VERSION } from "../city/contracts.js";
import { mappingForClause } from "./mappings.js";

const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const safeId = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
function digest(text) { let hash = 2166136261; for (const c of text) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619); return (hash >>> 0).toString(16); }
const exactString = (value, fallback = "") => typeof value === "string" ? value : fallback;
function metadata(value) { return value == null ? null : typeof value === "string" || finite(value) || typeof value === "boolean" ? value : null; }

/** Normalize only public proposal fields. Deliberately never copy citizen quotes,
 * journals, author identities, individual answers, raw demand or user records.
 * Supported payloads: raw synthesize package array, {packages:[...]}, selected
 * package {id,items:[{proposal:...}]}, and an already normalized plan.
 */
export function normalizeDearCongressPlan(payload, { sourceUrl = "https://dear-congress.fly.dev/api/synthesize", retrievedAt = null, packageId = "A" } = {}) {
  if (!safeId(packageId)) throw new Error("Choose a valid packageId.");
  const packages = Array.isArray(payload) ? payload : Array.isArray(payload?.packages) ? payload.packages : Array.isArray(payload?.plans) ? payload.plans : null;
  const selected = packages ? packages.find((row) => row?.id === packageId) : payload?.package || payload;
  if (!object(selected) || (packages && !selected) || (selected.id && selected.id !== packageId && selected.schemaVersion !== "constitution-city-plan.v1")) throw new Error(`Dear Congress package ${packageId} is unavailable.`);
  const rows = selected.items || selected.clauses || selected.proposals;
  if (!Array.isArray(rows) || rows.length > 128) throw new Error("A public package must contain at most 128 proposal rows.");
  const ids = new Set();
  const clauses = rows.map((item) => {
    const proposal = object(item?.proposal) ? item.proposal : item;
    if (!object(proposal) || !safeId(proposal.id) || ids.has(proposal.id)) throw new Error("Clause IDs must be valid, unique source proposal IDs.");
    ids.add(proposal.id);
    const title = exactString(proposal.title), text = exactString(proposal.text, exactString(proposal.clauseText, title));
    if (!title.trim() || title.length > 500 || !text.trim() || text.length > 20000) throw new Error(`Invalid exact source text for ${proposal.id}.`);
    if (proposal.costB != null && (!finite(proposal.costB) || proposal.costB < 0 || proposal.costB > 1000000)) throw new Error(`Invalid source costB for ${proposal.id}.`);
    const mapping = mappingForClause(proposal.id);
    const limitations = [...mapping.limitations];
    const textSource = selected.schemaVersion === "constitution-city-plan.v1" && ["proposal.text","proposal.clauseText","proposal.title"].includes(proposal.textSource) ? proposal.textSource
      : typeof proposal.text === "string" ? "proposal.text" : typeof proposal.clauseText === "string" ? "proposal.clauseText" : "proposal.title";
    if (textSource === "proposal.title") limitations.push("The public source provides a proposal title, not enacted constitutional text or a full policy specification. The title is preserved verbatim as text.");
    if (proposal.costB == null) limitations.push("Source program cost is unavailable; no zero-cost assumption is inferred.");
    return { id: proposal.id, title, text, textSource, needId: exactString(proposal.needId), costB: proposal.costB ?? null,
      mechanism: exactString(proposal.mechanism), authority: exactString(proposal.authority), jurisdiction: exactString(proposal.jurisdiction),
      legalChange: exactString(proposal.legalChange), changeLevel: metadata(proposal.changeLevel), evidence: metadata(proposal.evidence),
      metrics: Array.isArray(proposal.metrics) ? proposal.metrics.filter((value) => typeof value === "string").slice(0, 64) : [],
      ...(typeof proposal.rightsIssue === "string" ? { rightsIssue: proposal.rightsIssue } : {}),
      dependencies: Array.isArray(proposal.dependencies) ? proposal.dependencies.filter((value) => typeof value === "string").slice(0,64) : [],
      conflicts: Array.isArray(proposal.conflicts) ? proposal.conflicts.filter((value) => typeof value === "string").slice(0,64) : [],
      rightsContext: { legalDetermination: false, note: "Source metadata is not an adjudication of legality, rights, conflicts or authority." },
      supported: mapping.supported, mapping, limitations };
  });
  const sourcePackageId = selected.schemaVersion === "constitution-city-plan.v1" ? selected.provenance?.packageId || packageId : selected.id || packageId;
  return { schemaVersion: "constitution-city-plan.v1", id: `dc-${sourcePackageId}-${digest(JSON.stringify(clauses.map(({id,text,costB}) => ({id,text,costB}))))}`,
    label: exactString(selected.label, exactString(selected.name, `Dear Congress package ${sourcePackageId}`)), clauses,
    provenance: { sourceUrl, retrievedAt: retrievedAt ?? payload?.retrievedAt ?? selected.provenance?.retrievedAt ?? null, packageId: sourcePackageId, sourceType: "policy proposal package; not enacted constitutional text", privacy: "Public proposal fields only; no journals, quotes, authors or individual answers retained.",
      evidenceInterpretation: "Source evidence values are publisher-supplied metadata, not verified empirical calibration or probabilities.",
      nationalToCityScale: "Source costs span municipal, county, state and federal jurisdictions. A separate explicit synthetic scale is required; none is inferred from residents." } };
}

/** Compile a NEW CityState using actual addIntervention governance/construction.
 * Supported cost is a one-time synthetic capital envelope, NOT annual national
 * spending. No money is charged until the engine reaches the funding stage.
 * Budget is distributed ONCE per clause in integer cents, never duplicated by
 * district count. Unsupported selections remain visible metadata with no forecast.
 */
export function applyClausePlan(initial, plan, { clauseIds, compliance = 1, delayMonths = 0, sunsetYears = 0, costScale = 0.0001, scenarioId = "proposal" } = {}) {
  validateState(initial);
  if (plan?.schemaVersion !== "constitution-city-plan.v1" || !Array.isArray(plan.clauses)) throw new Error("A normalized Dear Congress clause plan is required.");
  if (!finite(compliance) || compliance < 0 || compliance > 1 || !Number.isInteger(delayMonths) || delayMonths < 0 || delayMonths > 360 || !finite(costScale) || costScale < 0 || costScale > 1 || !safeId(scenarioId)) throw new Error("Invalid bounded plan compliance, delay, scale or scenario identifier.");
  if (!Number.isInteger(sunsetYears) || sunsetYears < 0 || sunsetYears > 30) throw new Error("sunsetYears must be an integer0–30.");
  if (sunsetYears > 0) throw new Error("Automatic policy sunset is unavailable: the existing engine has no reversible active-policy lifecycle, and completed assets cannot be silently undone.");
  const requested = clauseIds ?? plan.clauses.map((row) => row.id);
  if (!Array.isArray(requested) || requested.some((id) => !plan.clauses.some((row) => row.id === id))) throw new Error("Selected clauseIds must refer to this plan.");
  const selected = [...new Set(requested)];
  let state = structuredClone(initial);
  const ledger = [], unavailable = [];
  for (const id of selected) {
    const clause = plan.clauses.find((row) => row.id === id), mapping = mappingForClause(id);
    if (!mapping.supported || clause.supported !== true) { unavailable.push({ clauseId: id, title: clause.title, reason: mapping.limitations[0] || "Unavailable forecast" }); continue; }
    if (!finite(clause.costB) || clause.costB < 0) throw new Error(`A source cost or explicit revised assumption is required for ${id}.`);
    if (state.policies.some((policy) => policy.constitutionClauseId === id && policy.constitutionPlanId === plan.id)) throw new Error(`Clause ${id} is already compiled; use the frozen initial state to avoid double billing.`);
    const totalCents = Math.round(clause.costB * 1e9 * costScale * 100);
    if (!Number.isSafeInteger(totalCents) || totalCents > 1e14) throw new Error(`Scaled budget for ${id} exceeds the city adapter's safe currency bound.`);
    const districts = [...state.districts].sort((a,b) => a.id.localeCompare(b.id));
    const targets = mapping.allocation === "single-synthetic-hub" ? districts.filter((district) => state.links.some((link) => link.mode === "transit" && (link.from === district.id || link.to === district.id))).slice(0,1) : districts;
    if (!targets.length) { unavailable.push({ clauseId: id, title: clause.title, reason: "The selected city has no transit links for this adapter." }); continue; }
    const policyIds = [], legalDeltas = [];
    let assignedCents = 0;
    if (compliance > 0) for (const [index, district] of targets.entries()) {
      const cents = index === targets.length - 1 ? totalCents - assignedCents : Math.floor(totalCents / targets.length);
      assignedCents += cents;
      // Upzone's actual engine path does not multiply amount by compliance;
      // scale it here exactly once. Project paths already do that themselves.
      const amount = mapping.type === "upzone" ? mapping.amount * compliance : mapping.amount;
      state = addIntervention(state, { type: mapping.type, districtId: district.id, amount, cost: cents / 100, compliance, delay: delayMonths });
      const policy = state.policies.at(-1);
      const parcelDeltas = mapping.type === "upzone" ? state.parcels.filter((parcel) => parcel.districtId === district.id).map((parcel) => ({ parcelId: parcel.id,
        baselineCapacity: parcel.capacity, baselineFar: parcel.far, capacityDelta: Math.floor(amount),
        farDelta: Math.max(0,Math.min(20,parcel.far + amount/1000) - parcel.far), nominalFarDelta: amount/1000, farCap: 20,
        basis: "Planned engine mutation; overlapping authorizations require actual activation-time attribution before reversal." })) : [];
      Object.assign(policy, { clauseId: id, constitutionClauseId: id, constitutionPlanId: plan.id, constitutionScenarioId: scenarioId, adapterVersion: "dc-city-adapter.1.0.0", sourceCostB: clause.costB, costScale, legalDeltas: parcelDeltas });
      legalDeltas.push(...parcelDeltas.map((delta) => ({ ...delta, policyId: policy.id })));
      policyIds.push(policy.id);
    }
    ledger.push({ clauseId: id, supported: true, sourceCostB: clause.costB, sourceCostUsd: clause.costB * 1e9, jurisdiction: clause.jurisdiction,
      syntheticLocalBudgetUsd: totalCents / 100, committedLocalBudgetUsd: assignedCents / 100, compliance, delayMonths, policyIds,
      targetDistrictIds: targets.map((district) => district.id), allocation: mapping.allocation, legalDeltas, costBasis: "One-time synthetic capital envelope, not an annual source appropriation", assumption: mapping.assumption });
  }
  state.provenance = { ...state.provenance, constitutionPlan: { schemaVersion: "constitution-city-application.v1", planId: plan.id, scenarioId,
    clauseIds: selected, adapterVersion: "dc-city-adapter.1.0.0", engineVersion: VERSION, costScale, compliance, delayMonths, sunsetYears,
    committedLocalBudgetUsd: ledger.reduce((sum,row) => sum + row.committedLocalBudgetUsd,0), ledger, unavailable,
    assumptions: ["Source-listed costs retain their original stated jurisdictions. National/local budget equivalence is not asserted.", "Cost scale, spatial allocation and numerical effects are synthetic analyst assumptions, not causal estimates.", "Compliance scales effect size, not the full contracted capital envelope. Zero compliance schedules no intervention or charge.", "Rights, conflicts and authority require human legal review; no legal determination is made."] } };
  state.constitutionCity = { ...state.constitutionCity, planId: plan.id, scenarioId,
    clausePolicies: state.policies.filter((policy) => policy.constitutionPlanId === plan.id).map((policy) => ({ clauseId: policy.clauseId, policyId: policy.id,
      districtId: policy.districtId, type: policy.type, legalDeltas: structuredClone(policy.legalDeltas || []) })),
    legalDeltaBasis: "Record actual activation deltas if overlapping authorizations affect the same capped FAR; never erase funded construction or sunk costs." };
  validateState(state);
  return state;
}
