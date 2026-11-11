# Sharing handoff

Owned adapter: world/decision/backlog-sharing/appendix.js; tests: test/backlog-sharing.test.js.

174: Partial. Exact saved-manifest printable appendix and download adapter implemented, with escaped content, 128 KiB print bound, explicit oversized notice, 8 MiB export bound, missing-record behavior. Shared mount still required. Coordinator: import reproductionAppendix and downloadManifest; fetch `const manifest = await client.manifest(state.experiment.id)` using existing error handling; append `reproductionAppendix(manifest).html` to brief content and bind a download button to `downloadManifest(manifest)`. Keep the fetched same manifest for both. Do not reconstruct from compact result rows. For standalone brief HTML, use the existing manifest export control or embed a safely escaped download payload; do not claim the adapter alone supplies standalone wiring.

177: Deferred. savedReadonlyLink(base,id) normalizes the existing saved experiment route and removes credentials/unrelated query state. No QR encoder implemented or validated. Do not report QR acceptance.

Verification: bun test ./test/backlog-sharing.test.js: 3 passing tests covering exact JSON roundtrip, units/model/seed/time/null preservation, HTML escaping, missing record, bounds, saved URL roundtrip. No browser screenshots: shared mounts are coordinator-owned and unwired. No empirical calibration claims. No shared files changed.
