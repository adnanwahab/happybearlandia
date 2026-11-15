#!/usr/bin/env node
// Compatibility entry point: merged source is evidence, not issue acceptance.
import { readFileSync } from 'node:fs';
import { syncMergedPR } from '../.github/scripts/sync-merged-pr.cjs';

try {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const result = await syncMergedPR({ event,
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.LINEAR_API_KEY });
  console.log(JSON.stringify(result));
} catch {
  // Event parsing/transport failures may include private input; never echo them.
  console.error('Merged PR synchronization failed; inspect event identity and LINEAR_API_KEY setup, then rerun');
  process.exitCode = 1;
}
