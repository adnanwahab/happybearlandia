import { parameters } from "./schema.js";
import { validateBuildingProposal } from "../../buildings/proposal.js";
import { simulateHousingRun, stressPresets } from "./index.js";

/** TIMELINE FORK v1. month is the last UNCHANGED completed month. Operations
 * apply at month+1 in the original run's live loop: RNG, pipeline, balances,
 * initial-project risk draws and progress are never reset or spliced. Operations
 * use existing WorldEdit vocabulary; no equations/code or initial-stock rewrites.
 * A branch at the horizon is allowed and has no numerical effect.
 * Engine retains monthlyTimeline:[{month,year,metrics}] plus fork lineage.
 */
export function validateHousingFork(fork, { years = 10 } = {}) {
  const errors = [];
  if (!fork || typeof fork !== "object" || Array.isArray(fork)) return { valid: false, values: null, errors: ["fork must be {month,operations}."] };
  if (!Number.isInteger(fork.month) || fork.month < 0 || fork.month > years * 12) errors.push("Fork month must be an integer within the simulation horizon.");
  if (!Array.isArray(fork.operations) || fork.operations.length > 32) errors.push("Fork operations must be an array with at most 32 edits.");
  if (fork.month === years * 12 && fork.operations?.length) errors.push("Fork interventions require at least one future month after the branch.");
  const initial = new Set(["initial_housing", "initial_households", "initial_rent", "initial_income"]);
  const definitions = new Map(parameters.map((parameter) => [parameter.id, parameter]));
  const operations = [];
  for (const raw of Array.isArray(fork.operations) ? fork.operations : []) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { errors.push("Invalid fork operation."); continue; }
    const { op, value } = raw;
    const target = typeof raw.target === "string" ? raw.target.replace(/^scenario\./, "") : "";
    if (op === "set_parameter") {
      const id = target.replace(/^parameters\./, "");
      const definition = definitions.get(id);
      if (!definition || initial.has(id)) errors.push(`Fork cannot rewrite ${id || "unknown parameter"}; initial conditions are immutable.`);
      else if (typeof value !== "number" || !Number.isFinite(value) || value < definition.min || value > definition.max) errors.push(`Fork ${id} is outside parameter bounds.`);
      else operations.push({ op, target: id, value });
    } else if (op === "add_building") {
      const checked = validateBuildingProposal(value);
      if (!["world.projects", "projects"].includes(target)) errors.push("add_building must target world.projects.");
      if (!checked.valid) errors.push(...checked.errors);
      else if (checked.values.status !== "approved") errors.push("A fork building must be explicitly approved; drafts remain inert.");
      else operations.push({ op, target: "world.projects", value: checked.values });
    } else if (["update_building", "move_building"].includes(op)) {
      errors.push("Timeline forks cannot redesign or move existing buildings: historical geometry must remain immutable. Cancel an unfinished project or add a new approved building.");
    } else if (op === "remove_building") {
      const id = target.replace(/^(?:world\.)?projects\./, "");
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(id)) errors.push("Fork building target must be a project identifier.");
      else operations.push({ op, target: id });
    } else if (op === "apply_stress_preset") {
      const id = typeof value === "string" ? value : value?.presetId;
      if (!stressPresets.some((preset) => preset.id === id) || (value && typeof value === "object" && value.startMonth !== undefined)) errors.push("Fork stress must be a known preset starting immediately after the branch; nested schedules are unsupported.");
      else operations.push({ op, target: "stressPresets", value: id });
    } else errors.push(`Unsupported timeline-fork operation: ${op}`);
  }
  const values = errors.length ? null : { month: fork.month, operations,
    ...(typeof fork.parentRunId === "string" ? { parentRunId: fork.parentRunId } : {}),
    ...(typeof fork.parentExperimentId === "string" ? { parentExperimentId: fork.parentExperimentId } : {}) };
  return { valid: errors.length === 0, values, errors };
}

export function simulateHousingFork(input = {}) {
  if (!input.fork) throw new Error("simulateHousingFork requires a fork contract.");
  return simulateHousingRun(input);
}
