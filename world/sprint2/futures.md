# Saved Futures Library

Open `/world/sprint2/futures.html`. The existing World static route serves the page.
It filters by exact seed, model, run kind and inclusive month overlap. The month
picker shows only saved checkpoints within the selected range.

## Server integration

Import `createSavedFuturesHandler` from `world/sprint2/futures-api.js`.
Create it with `{ store }`, where `store` is the same causal store passed to
`createCausalityHandler` (the `.causality` property of the existing World
persistence store). Pass the handler in `createCausalityHandler({ store,
extensions: [savedFuturesHandler] })`. It serves GET
`/api/causality/saved-futures` and returns `null` for other routes.

The default public allowlist contains the deterministic demo run. Record it
through the Time Machine to populate an empty library. Hosts may supply
`publicRunIds` after reviewing the complete history of each run for public
access. The catalog reads only approved IDs and returns run identity, seed,
model, kind and recorded months. The currently supported model and adapter
match the Time Machine. Existing causal API access rules are unchanged.
