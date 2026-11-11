#!/usr/bin/env bun
// Snapshot a voted READY queue for auditing or external orchestration.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createPatchVotingStore } from './api.js';
import { buildReadyQueue } from './queue.js';

const DEFAULT_STATE = resolve('ops/agent-factory/verified.json');
const DEFAULT_OUTPUT = resolve('.hbl-private/dispatch/ready.json');
export async function generateQueue(options = {}) {
  const verifiedPath = options.verifiedPath || DEFAULT_STATE;
  const output = options.output || DEFAULT_OUTPUT;
  const state = JSON.parse(await readFile(verifiedPath, 'utf8'));
  if (!Array.isArray(state.verifiedTaskIds) || !Array.isArray(state.activeTaskIds)) throw new Error('verified manifest must contain verifiedTaskIds and activeTaskIds arrays');
  const store = createPatchVotingStore(options);
  let selection;
  try {
    selection = buildReadyQueue(store.list(), {
      verifiedTaskIds: state.verifiedTaskIds, activeTaskIds: state.activeTaskIds,
      minUpvotes: options.minUpvotes, minScore: options.minScore
    });
  } finally {
    store.close();
  }
  const result = {
    schemaVersion: 'hbl-agent-queue.v1', generatedAt: new Date().toISOString(),
    baseBranch: 'sprint/one-city-two-futures-20261111',
    ...selection
  };
  await mkdir(dirname(output), { recursive: true });
  const temp = output + '.' + process.pid + '.tmp';
  await writeFile(temp, JSON.stringify(result, null, 2) + '\n');
  await rename(temp, output);
  return result;
}
if (import.meta.main) {
  try {
    const result = await generateQueue();
    console.log(JSON.stringify({ ready: result.tasks.length, skipped: result.skipped.length, output: DEFAULT_OUTPUT }));
  } catch (e) {
    console.error('Queue export failed:', e.message);
    process.exitCode = 1;
  }
}
