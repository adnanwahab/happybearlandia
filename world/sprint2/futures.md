# Saved Futures Library

Open `/world/sprint2/futures.html`. The existing World static route serves the page.
It filters by exact seed, model, run kind and inclusive month overlap. The month
picker shows only saved checkpoints within the selected range.

## Server integration

The causality dispatcher mounts `createSavedFuturesHandler({ store })` with
the same causal store used for replay. It serves GET
`/api/causality/saved-futures`.

The default public allowlist contains the deterministic demo run. Record it
through the Time Machine to populate an empty library. Hosts may supply
`publicRunIds` after reviewing the complete history of each run for public
access by mounting a custom handler in the dispatcher's `extensions` array.
The catalog reads only approved IDs and returns run identity, seed,
model, kind and recorded months. The currently supported model and adapter
match the Time Machine. Existing causal API access rules are unchanged.
