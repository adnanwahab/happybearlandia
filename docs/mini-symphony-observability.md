# Measuring a 25-hour Mini Symphony run

Open `/mini-symphony` on the local HappyBearLandia server. The dashboard is
read-only: it neither launches workers nor changes execution approvals.

The first measurement is **one continuous observed coordinator session**. Each
start creates a new session ID. Regular 15-second heartbeats and phase changes
show that it continued running. A gap over 60seconds, a missing event sequence,
or a restart breaks observed continuity. Missing time is never filled from the
wall clock. Laptop sleep and slow synchronous Git/GitHub commands can cause gaps;
a stale heartbeat means unobserved, not necessarily that the process died.

The 25-hour bar measures runtime, not useful coding. Read it alongside:

- **Coding time:** union of worker-active intervals, including worktree preparation
  and Codex execution. It includes model/tool waiting and does not prove useful
  edits. Two concurrent workers never turn one hour into two hours of runtime.
- **Publishing time:** commit/push/PR preparation after a worker finishes.
- **Waiting time:** no active worker. An idle coordinator can reach25hours of
  runtime while delivering no code; the dashboard explicitly identifies that.
- **Unobserved time:** heartbeat or sequence gaps, excluded from goal credit.
- **Output:** confirmed new draft-PR receipts, final task attempts, failures,
  no-change outcomes and publication errors. Imported/reused PRs are excluded.
  A PR or a zero exit is not a passing test suite or accepted implementation.
- **External interruptions/edits:** observed signals or task-file edits outside
  this runner. These may come from an operator or another automation; their
  absence cannot prove that no human helped elsewhere.

For example, a 26-hour observed run with 2hours coding and 24hours waiting reaches
the runtime threshold but is not 25hours of coding. A 10-hour run plus a restarted
15-hour run is two sessions, not one25-hour session. The dashboard reports both
runtime and coding target flags separately and preserves session history.

## Run and read the logs

Start the updated runner normally. HappyBearLandia uses `bun run symphony:mini`;
Dear Congress uses the same command from its own checkout. The HBL command no
longer uses hot reload: changing runner source should not silently restart a long
experiment. Existing running processes retain their old code; let a worker finish
before restarting to load instrumentation. No historical runtime is backfilled.

The start message prints the session ID and text-log path:

```text
<project data directory>/telemetry/sessions/<session ID>/session.log
<project data directory>/telemetry/sessions/<session ID>/events.jsonl
```

`session.log` is a readable operations timeline: task claims, board refreshes,
queue exhaustion, output activity notices, publication results and stop reasons.
`events.jsonl` is the matching version 1 measurement record with monotonic elapsed
time, wall-clock timestamps and ordered sequence numbers. Raw Codex output stays
in existing `logs/<task>.log` files and is not exposed by the dashboard. The
Download text log action exports only curated, redacted event records.

Each Codex task still has its own default one-hour timeout. That is not a one-hour
coordinator/session limit. A timed-out task is failed even if its signal handler
exits 0; a worker that ignores termination is forcibly stopped after a bounded
10-second grace period. The coordinator can then continue with other runnable
work. Keeping the machine awake and a reviewed queue available is necessary for
a long useful run; the dashboard does not invent work to keep itself busy.

## Local project sources and limits

The operator API reads explicitly configured roots from
`.hbl-private/mini-symphony-sources.json`, or a file supplied through
`HBL_MINI_SYMPHONY_SOURCES`. Relative roots are relative to the server working
directory. Without this file only the HBL root is read. Example:

```json
{"projects":[
  {"id":"happybearlandia","name":"HappyBearLandia","repository":"adnanwahab/happybearlandia","root":"."},
  {"id":"dear-congress","name":"Dear Congress","repository":"adnanwahab/dear_congress","root":"/absolute/path/to/dear_congress/.mini-symphony"}
]}
```

`GET /api/mini-symphony` returns metrics and recent curated events.
`GET /api/mini-symphony/log?project=<id>&session=<uuid>` downloads that session's
curated log. The API accepts loopback, same-origin, read-only requests only.
Requests cannot select arbitrary filesystem roots. Source paths, prompts, raw
transcripts and credentials are excluded; responses have no-store headers.

The dashboard shows the latest 10sessions from a bounded 500-folder scan and reads
at most 16 MiB per source file. Unreadable/oversized evidence is marked unavailable,
not counted as success. Logging failure stops heartbeat evidence and reports a
console diagnostic while allowing coding to continue. The session's curated
heartbeat/activity logs are small append-only files; raw worker transcripts can
still grow. Retain session records for comparisons and review disk usage before
very long runs.

Earlier state.json task totals are shown only as **legacy history**. They cannot
establish how long an old autonomous session lasted. Start collecting now, compare
longest continuous duration, coding utilization, PR output and failure reasons
across sessions, and use those observations to choose the next reliability fix.
