# Import a canonical run receipt

Open Future Machine and choose **Import run receipt**, or visit
`/world/future-machine/share/import.html`. Paste JSON or choose a file; a selected
file takes precedence. Inputs are limited to 4,500,000 UTF-8 bytes; file size is
checked before reading and text size before JSON parsing. Invalid JSON, unknown
schema/model/rules, altered checksums, missing saved experiments and differing
replay hashes display an error without a success link. Choosing/editing input or
starting another verification clears the previous success. Cancel aborts replay
and ignores late results.

This imports `canonical-run-receipt.v1` from SHE-83's canonical exporter
(`bun scripts/export-run-receipt.js BASE_URL city_ID MONTH`). The existing UI's
**Export evidence** exports a different evidence report and is not a canonical
receipt. The form explains that distinction. No remote URL from a receipt is
fetched: the existing loader uses same-origin saved City APIs. Receipt validation,
model manifests, selected-month and terminal hashes remain authoritative.

A verified result links to Future Machine using the same saved experiment,
recipe and month. The link recomputes the saved comparison through its normal
entry point; verification does not claim an independent observed checkpoint.
Receipts without a persisted experiment, or from another server where the saved
record is unavailable, cannot reopen here. Raw receipt content is not stored in
browser storage or uploaded to a new endpoint. Replays use the existing API and
may perform bounded server computation. Existing model/source limits still apply.

Verification: `bun test test/run-receipt-import.test.js test/run-receipt.test.js
 test/future-machine-share.test.js test/future-machine-ui.test.js` and
`bun test/receipt-import.browser-smoke.mjs` with the disposable server on port3394.
