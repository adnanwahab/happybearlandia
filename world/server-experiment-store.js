import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const DEFAULT_DIR = process.env.HBL_EXPERIMENT_DIR || "data/civic-experiments";
const stable = (value) => Array.isArray(value)
  ? `[${value.map(stable).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`
    : JSON.stringify(value);

export function hashExperimentSnapshot(snapshot) {
  return createHash("sha256").update(stable(snapshot)).digest("hex");
}

function safeId(id) {
  const value = String(id || "");
  if (!/^experiment_[a-zA-Z0-9_-]{6,128}$/.test(value)) throw new Error("Invalid experiment id");
  return value;
}

function recordPath(root, id) {
  return join(root, `${safeId(id)}.json`);
}

async function ensureRoot(root) {
  await mkdir(root, { recursive: true });
}

export function createServerExperimentRecord(snapshot, options = {}) {
  if (!snapshot?.experiment?.id && !snapshot?.id) throw new Error("Experiment snapshot requires an experiment id");
  const createdAt = options.createdAt || new Date().toISOString();
  const snapshotHash = hashExperimentSnapshot(snapshot);
  const id = options.id || `experiment_${snapshotHash.slice(0, 20)}`;
  return {
    schemaVersion: "hbl-server-experiment.v1",
    id,
    createdAt,
    updatedAt: createdAt,
    immutable: true,
    parentExperimentId: options.parentExperimentId || snapshot?.lineage?.parentExperimentId || null,
    relationship: options.relationship || null,
    snapshotHash,
    title: snapshot?.experiment?.plan?.title || snapshot?.plan?.title || "Civic experiment",
    modelVersion: snapshot?.model?.simulatorVersion || snapshot?.simulationBatch?.adapter?.id || null,
    seed: snapshot?.worldBatch?.seed ?? snapshot?.experiment?.experiment?.seed ?? null,
    runs: snapshot?.worldBatch?.runs ?? snapshot?.simulationBatch?.simulations?.length ?? 0,
    snapshot,
  };
}

export async function saveServerExperiment(snapshot, options = {}) {
  const root = options.root || DEFAULT_DIR;
  const record = createServerExperimentRecord(snapshot, options);
  await ensureRoot(root);
  const target = recordPath(root, record.id);
  try {
    const existing = JSON.parse(await readFile(target, "utf8"));
    if (existing.snapshotHash !== record.snapshotHash) throw new Error(`Immutable experiment ${record.id} already exists with different content`);
    return existing;
  } catch (error) {
    if (error?.code !== "ENOENT" && !String(error?.message || "").startsWith("Unexpected")) throw error;
  }
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(tmp, target);
  return record;
}

export async function loadServerExperiment(id, options = {}) {
  const root = options.root || DEFAULT_DIR;
  try {
    return JSON.parse(await readFile(recordPath(root, id), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function listServerExperiments(options = {}) {
  const root = options.root || DEFAULT_DIR;
  await ensureRoot(root);
  const files = (await readdir(root)).filter((name) => /^experiment_.*\.json$/.test(name));
  const rows = [];
  for (const file of files) {
    try {
      const row = JSON.parse(await readFile(join(root, file), "utf8"));
      rows.push(row);
    } catch { /* ignore partial/corrupt files in listing */ }
  }
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function listExperimentChildren(parentId, options = {}) {
  return (await listServerExperiments(options)).filter((row) => row.parentExperimentId === parentId);
}

export async function forkServerExperiment(parentId, snapshot, options = {}) {
  const parent = await loadServerExperiment(parentId, options);
  if (!parent) throw new Error(`Parent experiment not found: ${parentId}`);
  return saveServerExperiment(snapshot, {
    ...options,
    parentExperimentId: parentId,
    relationship: options.relationship || "fork",
  });
}
