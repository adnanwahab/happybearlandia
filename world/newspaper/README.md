# Living Newspaper and editorial challenge

Enter from World’s Living Newspaper link or `/world/newspaper/index.html`.
The archive and editor read the pinned `world-only-2911` monthly City scenario
(seed 2911, 20 months). Record it explicitly in `/world/causal.html` first.
The editor never records or recomputes a scenario automatically.

Choose three different recorded event headlines. Each candidate links to the
existing immutable event inspector. Label “A turning point for Riverside” as
interpretation/scripted flavor. The guaranteed-future treatment fails review
even with that label: an event cannot support a prediction. Passing review
exposes a copyable JSON front page containing full events, source provenance,
run context, seed, model version and evidence links. Copying is manual; no
publication, external message or public storage is performed.

The desk holds detached source records. Review rereads the archive and compares
its run and stories with the opened desk; changed evidence, seed or model
context blocks output as a replay/source mismatch. This verifies source
consistency only, not independent replay equivalence. No-source, incomplete-run,
network failure, cancellation and edits after review clear or withhold output.
Cancel discards only the local draft. In-flight results are ignored after
cancel, restart or edits.

These are editorial rules over existing synthetic model events, not new social
simulation mechanics. No measured observations are supplied by this scenario.
The City model and checkpoint schedule are unchanged; see
`docs/models/README.md`, `world/city/README.md`, `shared/causality/README.md` and
`world/replay/README.md`. This bounded desk offers authored treatments, not
free-text fact checking. It does not claim to evaluate arbitrary prose.

Checks: `bun test test/newspaper-editor.test.js test/living-newspaper.test.js`
and `bunx playwright test --config test/newspaper-editor.browser.config.js`.
