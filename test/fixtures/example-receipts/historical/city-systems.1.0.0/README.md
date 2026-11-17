# Historical City 1.0 example receipts

The two receipts and `hashes.json` retain the exact original bytes from PR #215
head `a4634b11f1c130701b004eeb0c85ee15f0d607b2`, at the corresponding
filenames under `test/fixtures/example-receipts/`. Recipes, rules, recorded
observations, checksums and canonical whole-receipt hashes remain unchanged.

These are synthetic, unsaved historical examples. The current City 1.1 validator
intentionally rejects their unavailable model version. Reproducing them requires
the old implementation; the normal receipt CLI reads and regenerates only the
current files two directories above. Byte-integrity and strict-version rejection
checks are in `test/example-receipts.test.js`.
