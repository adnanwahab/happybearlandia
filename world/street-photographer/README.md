# Street Photographer Detective — authored case v1

Entry: `/world` → World controls → Street Photographer Detective, then Load pinned
demo. Direct URL: `/world/street-photographer/index.html`. No network provider,
account, camera hardware or GPU is required. The server's existing `/world`
static route serves the native page, modules and fixture.

`scenario.json` is the single pinned data source: street-mystery.1,
street-photo.1, toy:street:712:v1, seed 712. It is hand-authored synthetic toy
history, not measured observations or output from City/Population. The seed is
retained as identity and consumes no RNG. No baseline/alternative runs are made;
repeated attempts use identical checkpoints and seed. Dates are fictional civil
dates; ticks 0/1/2 index May/June/July 2046. Entity IDs are local toy IDs, with no
mapping to OSM, Population, City or shared canonical entities.

Clues reference `(checkpointId, entityId)` pairs: May/bakery, June/notice,
July/bench. They reveal an authored repair closure and returning deliveries.
The interpretation and prompts are scripted flavor, not measured causal evidence.
No photograph is generated, saved or uploaded: Capture clue records a framing
receipt. The SVG is a 240-unit-wide orthographic camera onto a flat illustrative
street, pan 0–360. A subject's full horizontal extent must fit inside the frame.
All subjects share vertical bounds 35–112 within height 150; no occluders exist.
Visibility is therefore exact interval containment, not a claim about 3D ray
casting, physical photography or GPU render visibility. This assumption belongs
beside the check in `case.js`. The text record action bypasses only framing.

## Invariants and failure states

- `createCase` validates the entire canonical JSON against an independently pinned
  SHA-256 before cloning/deep-freezing it. Changed identity, label, date, geometry,
  source, version, seed or missing checkpoint cannot become a replacement result.
  JSON object key order is immaterial; record-array order is part of the version.
  Changing the authored scenario requires a new version and reviewed digest.
- Exactly three clues advance in order, at most once per case. Wrong date,
  wrong entity, missing checkpoint, invalid mode or camera leave progress alone.
  Optional externally supplied replay snapshots must match the selected record.
- Photo and text receipts retain source identity, seed, versions, entity, date,
  checkpoint, tick, label and acquisition mode. Returned receipts are private
  copies; the source getter exposes only deeply frozen records.
- Source fetch failure/malformed/empty data reports missing evidence; mismatched
  fixture reports replay mismatch. No live data, recomputed or older checkpoint
  fallback. This is recorded authored playback, never verified recomputation.
- Cancel aborts a pending read and fences late results; it pauses an active case,
  retaining evidence. Resume preserves progress; restart clears page-local
  progress only. No storage, shared scores, analytics or production writes.
- Native select/buttons/details/range provide keyboard and touch controls. Arrow
  keys pan the camera; hints disclose exact location/date. Text inspection offers
  a complete non-camera alternative. No animation, sound or timer is required.

This is a deterministic authored scoring/presentation overlay, not an independent
agent-based social model. It adds no social behavior, scheduling, draws or model
outputs and does not change existing ODD descriptions.

## Checks

```
bun test test/street-photographer.test.js
bunx playwright test --config test/e2e/street-photographer.config.js
bun build world/street-photographer/page.js --target browser --outdir /tmp/she712-build
```

The browser harness serves real repository HTML/assets with Playwright request
interception. It strips World scripts to isolate the native navigation entry from
GPU/model startup; it does not certify the full live World renderer. It covers
390px/desktop reduced-motion navigation, keyboard framing/text capture, wrong date,
cancel/resume/restart, missing data, mismatch and late cancellation. See
`docs/reviews/SHE-712.md` for actual execution limits and typecheck command.
