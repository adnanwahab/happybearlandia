import { chmod, copyFile, mkdir, readdir, realpath, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { validId } from "../world/decision/contracts.js";
import { createDecisionStore, DECISION_OPTIMIZATION_DIRECTORY } from "../world/decision/store.js";

async function copySnapshot(source, destination, name) {
  const target = join(destination, name);
  await copyFile(join(source, name), target);
  await chmod(target, 0o600);
}

async function copyDirectory(source, destination, entries) {
  const files = new Set(entries.filter(entry => entry.isFile()).map(entry => entry.name));
  const snapshots = [...files].filter(name => name.endsWith(".json") && validId(name.slice(0, -5)));
  for (const name of snapshots) {
    await copySnapshot(source, destination, name);
    const summary = name.replace(/\.json$/, ".summary.json");
    if (files.has(summary)) await copySnapshot(source, destination, summary);
  }
  return snapshots.length;
}

export async function copyDecisionStore(source, destination) {
  const entries = await readdir(source, { withFileTypes: true });
  await mkdir(destination, { mode: 0o700 });
  try {
    const count = await copyDirectory(source, destination, entries);
    if (!entries.some(entry => entry.name === DECISION_OPTIMIZATION_DIRECTORY && entry.isDirectory())) {
      return count;
    }

    const optimizationSource = join(source, DECISION_OPTIMIZATION_DIRECTORY);
    const optimizationDestination = join(destination, DECISION_OPTIMIZATION_DIRECTORY);
    const optimizations = await readdir(optimizationSource, { withFileTypes: true });
    await mkdir(optimizationDestination, { mode: 0o700 });
    return count + await copyDirectory(optimizationSource, optimizationDestination, optimizations);
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
}

if (import.meta.main) {
  const [destination, source, ...extra] = process.argv.slice(2);
  if (!destination || extra.length) {
    console.error("Usage: bun scripts/backup-decision-store.js <new-destination-directory> [source-directory]");
    process.exitCode = 1;
  } else {
    try {
      const from = createDecisionStore({ directory: source }).directory;
      const to = createDecisionStore({ directory: destination }).directory;
      const canonicalTo = join(await realpath(dirname(to)), basename(to));
      createDecisionStore({ directory: canonicalTo });
      const count = await copyDecisionStore(from, canonicalTo);
      console.log(`Copied ${count} Decision Studio snapshots to ${to}`);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
