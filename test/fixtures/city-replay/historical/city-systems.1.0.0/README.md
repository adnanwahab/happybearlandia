# Historical City 1.0 replay evidence

These three JSON files are the exact original bytes from PR #198 head
`d7e1e3c29b034cf046ce4a32697cebf8ca5ee4cf`, at the corresponding filenames
under `test/fixtures/city-replay/`. Their recipes and rules remain
city-systems.1.0.0; no model fields or hashes were rewritten.

They describe synthetic modeled results. They are retained evidence, not the
active golden baselines for the current engine. The current CLI reads the files
two directories above. Reproducing these historical outputs requires the old
implementation pinned by the original commit. Byte-integrity checks are in
`test/city-replay-golden.test.js`.
