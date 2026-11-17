# Provenance Museum — bounded local receipt slice

Entry: World explorer → Provenance Museum (`/world/museum/`). Run a Policy Impact
Receipt comparison, then explicitly save the selected pair. No automatic capture,
network write or telemetry is added. Each room opens the original JSON snapshot
and links to the existing receipt route with its exact versioned `challenge`.
Replay is recomputation, not independent checkpoint verification.

## Contract

`hbl.provenance-museum.v1` is a browser-local JSON array, at most 20 entries:
`{ version: 1, recipe: string, receipt: PolicyReceipt }`. PolicyReceipt is owned by
`world/laboratory/receipts/receipt.js`; it includes model/scenario versions, seed,
policy, month interval, per-pair seeds, missing outcomes and measured model effects.
`recipe` preserves scenario seed, amount, selected pair and combined model version.
Save clones the completed receipt; selecting or recomputing never mutates it.
Duplicate recipes replace the local copy. At capacity the oldest exhibit is removed.
This is a user-controlled local record, not tamper-evident scientific storage.

No observed real-world sources are present. Assumptions come from the synthetic
Riverside quest/City rules. Receipt quantities are computed model effects; pair
counts are not resident counts or probabilities. CSS room architecture is decorative.
No new model rules, entity mappings, social mechanisms, causal claims or ODD changes.
Other engine forks and recorded discoveries are explicitly unavailable.

Missing/stale/invalid entries show receipt unavailable without a replay link.
Malformed collection or blocked storage shows an explicit storage error. Save errors
are reported without claiming success. Delete all removes only this museum key,
including corrupt data; it cannot delete other exports or upstream run records.
Cross-tab storage events refresh the gallery. No new graphics context, animation
loop, worker or GPU resources are allocated by the gallery.

Deterministic fixture: `test/museum-store.test.js` builds the existing 100-pair
commute model with seed 7, capacity 4 and selects pair 3. Unit checks include snapshot
isolation, selected-pair recipe identity, deduplication, deletion and missing versions.
Browser command: `bunx playwright test --config test/museum.browser.config.js`.
The static server checks the browser module journey, not Bun routing or production.
Consumer-device frame time/resource disposal measurements are unavailable here.
