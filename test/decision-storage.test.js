import { expect, test } from "bun:test";
import { mkdtemp, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_DECISION_STORE_DIR, DECISION_OPTIMIZATION_DIRECTORY, createDecisionStore } from "../world/decision/store.js";
import { copyDecisionStore } from "../scripts/backup-decision-store.js";

test("Decision Studio defaults to private repository state and honors explicit paths", () => {
  expect(DEFAULT_DECISION_STORE_DIR).toEndWith("/.data/decision-experiments");
  expect(createDecisionStore({ root: "/explicit-root" }).directory).toBe("/explicit-root");
  expect(createDecisionStore({ directory: "/directory", root: "/explicit-root" }).directory).toBe("/directory");
  expect(() => createDecisionStore({ directory: "visualizations/private" })).toThrow("publicly served");
  expect(() => createDecisionStore({ directory: "world/..private" })).toThrow("publicly served");
});

test("a store override cannot use a symlink into a served directory", async () => {
  const parent = await mkdtemp(join(tmpdir(), "hbl-decision-symlink-"));
  try {
    const link = join(parent, "redirect");
    await symlink(join(process.cwd(), "world"), link, "dir");
    await expect(createDecisionStore({ directory: link }).list()).rejects.toThrow("publicly served");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("backup and restore preserve full snapshots and summaries without overwriting a store", async () => {
  const parent = await mkdtemp(join(tmpdir(), "hbl-decision-backup-"));
  try {
    const source = join(parent, "source");
    const backup = join(parent, "backup");
    const restored = join(parent, "restored");
    const store = createDecisionStore({ directory: source });
    const record = {
      experiment: { id: "future_2026", status: "completed" },
      runs: [{ seed: 42, outcome: { rent: 1500 } }],
    };
    await store.save(record);
    const optimizer = createDecisionStore({ directory: join(source, DECISION_OPTIMIZATION_DIRECTORY) });
    const job = { experiment: { id: "opt_2026", status: "completed" }, runs: [] };
    await optimizer.save(job);
    await writeFile(join(source, "future_2026.json.write.tmp"), "partial");
    await writeFile(join(source, "deleted.summary.json"), "{}");
    expect(await copyDecisionStore(source, backup)).toBe(2);
    expect((await readdir(backup)).sort()).toEqual([DECISION_OPTIMIZATION_DIRECTORY, "future_2026.json", "future_2026.summary.json"]);
    expect((await stat(backup)).mode & 0o777).toBe(0o700);
    expect((await stat(join(backup, "future_2026.json"))).mode & 0o777).toBe(0o600);

    expect(await copyDecisionStore(backup, restored)).toBe(2);
    const recoveredOptimizer = createDecisionStore({ directory: join(restored, DECISION_OPTIMIZATION_DIRECTORY) });
    expect(await recoveredOptimizer.load(job.experiment.id)).toEqual(job);
    const recovered = createDecisionStore({ directory: restored });
    expect(await recovered.load(record.experiment.id)).toEqual(record);
    expect(await recovered.list()).toEqual([{ experiment: record.experiment }]);
    await expect(copyDecisionStore(backup, restored)).rejects.toMatchObject({ code: "EEXIST" });
    expect(await recovered.load(record.experiment.id)).toEqual(record);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
