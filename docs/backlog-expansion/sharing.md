# Sharing handoff

Owned adapter: world/decision/backlog-sharing/appendix.js; tests: test/backlog-sharing.test.js.

174: Partial. Exact saved-manifest printable appendix and download adapter implemented, with escaped content, 128 KiB print bound, explicit oversized notice, 8 MiB export bound, missing-record behavior. Shared mount still required. Coordinator: import reproductionAppendix and downloadManifest; fetch `const manifest = await client.manifest(state.experiment.id)` using existing error handling; append `reproductionAppendix(manifest).html` to brief content and bind a download button to `downloadManifest(manifest)`. Keep the fetched same manifest for both. Do not reconstruct from compact result rows. For standalone brief HTML, use the existing manifest export control or embed a safely escaped download payload; do not claim the adapter alone supplies standalone wiring.

177: Deferred. savedReadonlyLink(base,id) normalizes the existing saved experiment route and removes credentials/unrelated query state. No QR encoder implemented or validated. Do not report QR acceptance.

Verification: bun test ./test/backlog-sharing.test.js: 3 passing tests covering exact JSON roundtrip, units/model/seed/time/null preservation, HTML escaping, missing record, bounds, saved URL roundtrip. No browser screenshots: shared mounts are coordinator-owned and unwired. No empirical calibration claims. No shared files changed.

## QR follow-up
177 INTEGRATION-READY: `mountPresentationShare(container, location.href, state.experiment.id)` from `world/decision/backlog-sharing/qr.js` mounts accessible SVG plus saved read-only link. Call only after saved record exists; missing IDs render an explicit unavailable status. URLs discard credentials/query/hash and use existing experiment/readonly route. Byte-mode ECC M, automatic version, maximum 512 ASCII URL bytes, four-module white quiet zone; no service or network. Encoding implementation vendored from locally installed qrcode-terminal 0.12.0, Kazuhiko Arase QRCode, with original MIT attribution headers preserved; only CommonJS imports/exports converted to ES modules. No package dependency changes.

Focused checks now 4 passing / 14 assertions: known HELLO WORLD byte-mode codeword prefix, finder matrix vector, saved URL integrity and capacity errors, prior manifest tests. Coordinator must mount in shared presentation view and run normal-route browser smoke; no route screenshot yet. Appendix integration remains required for174. QR is not evidence of calibration or simulation correctness.

Independent decode attempt: generated PBM from the actual matrix, converted with macOS sips to PNG, invoked CoreImage CIDetector via Swift with writable module cache. Initial default cache denied by sandbox; second compile pending at handoff. No independent decoder success claimed yet.
