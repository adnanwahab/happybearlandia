import { mkdir, readdir, readFile, writeFile, rename, stat, unlink, open, realpath } from "node:fs/promises";
import { join, resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { clone, validId, DECISION_LIMITS } from "./contracts.js";

export const DECISION_OPTIMIZATION_DIRECTORY = "decision-optimizations";
export const DEFAULT_DECISION_STORE_DIR = fileURLToPath(
  new URL("../../.data/decision-experiments", import.meta.url),
);

function isWithin(parent, child) {
  const path = relative(parent, child);
  return path !== ".." && !path.startsWith(".." + sep) && !isAbsolute(path);
}

function requirePrivateDirectory(root, publicRoots) {
  if (publicRoots.some(path => isWithin(path, root))) {
    throw new Error("Decision store must be outside publicly served directories");
  }
}

/** Atomic JSON snapshots in a private state directory or an explicit mounted volume. */
export function createDecisionStore({ directory, root: configuredRoot } = {}) {
  const root = resolve(directory || configuredRoot || process.env.DECISION_STORE_DIR || DEFAULT_DECISION_STORE_DIR);
  const publicRoots = ["world", "data", "game", "tools", "blog", "visualizations"].map(path => resolve(path));
  requirePrivateDirectory(root, publicRoots);
  let initialized;
  async function initialize() {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const canonicalRoots = await Promise.all(publicRoots.map(async path => {
      try { return await realpath(path); }
      catch (error) { if (error.code === "ENOENT") return path; throw error; }
    }));
    requirePrivateDirectory(await realpath(root), canonicalRoots);
  }
  const ready = () => initialized ||= initialize().catch(error => {
    initialized = undefined;
    throw error;
  });
  const pathFor = (id) => { if (!validId(id)) throw new Error("Invalid experiment ID"); return join(root, `${id}.json`); };
  return {
    directory: root,
    async load(id) {
      await ready();
      try { return JSON.parse(await readFile(pathFor(id), "utf8")); }
      catch (error) { if (error.code === "ENOENT") return null; throw error; }
    },
    async save(record) {
      await ready();
      const path = pathFor(record.experiment.id);
      const temporary = `${path}.${crypto.randomUUID()}.tmp`;
      // Serialize one run at a time: a monthly replay can be hundreds of MiB.
      // A whole-record stringify would duplicate that payload on the 1 GiB VM.
      const output = await open(temporary, "w", 0o600);
      try {
        await output.writeFile(`{"experiment":${JSON.stringify(record.experiment)},"runs":[`);
        for (let index = 0; index < record.runs.length; index++) await output.writeFile(`${index ? "," : ""}${JSON.stringify(record.runs[index])}`);
        await output.writeFile("]}");
      } finally { await output.close(); }
      await rename(temporary, path);
      const summaryPath = join(root, `${record.experiment.id}.summary.json`);
      const summaryTemporary = `${summaryPath}.${crypto.randomUUID()}.tmp`;
      await writeFile(summaryTemporary, JSON.stringify({ experiment: record.experiment }), { mode: 0o600 });
      await rename(summaryTemporary, summaryPath);
    },
    async delete(id) {
      await ready();
      await Promise.all([pathFor(id), join(root, `${id}.summary.json`)].map(async (path) => {
        try { await unlink(path); } catch (error) { if (error.code !== "ENOENT") throw error; }
      }));
    },
    async list() {
      await ready();
      const entries = await readdir(root);
      const summaries = new Set(entries.filter((name) => /^[A-Za-z0-9_-]+\.summary\.json$/.test(name)));
      // Read small indexes; older snapshots without an index remain readable.
      const files = [...summaries, ...entries.filter((name) => /^[A-Za-z0-9_-]+\.json$/.test(name) && !summaries.has(name.replace(/\.json$/, ".summary.json")))];
      const dated = await Promise.all(files.map(async (name) => ({ name, time: (await stat(join(root, name))).mtimeMs })));
      const records = [];
      for (const { name } of dated.sort((a, b) => b.time - a.time).slice(0, DECISION_LIMITS.maxExperiments + DECISION_LIMITS.maxPreviews + DECISION_LIMITS.maxActive)) {
        try { records.push({ experiment: JSON.parse(await readFile(join(root, name), "utf8")).experiment }); } catch { /* A corrupt snapshot does not hide remaining experiments. */ }
      }
      return clone(records);
    },
  };
}

/** Injectable memory store for isolated tests; same async contract as disk store. */
export function createMemoryDecisionStore() {
  const records = new Map();
  return {
    async load(id) { return records.has(id) ? clone(records.get(id)) : null; },
    async save(record) { records.set(record.experiment.id, clone(record)); },
    async delete(id) { records.delete(id); },
    async list() { return [...records.values()].reverse().map(clone); },
  };
}
