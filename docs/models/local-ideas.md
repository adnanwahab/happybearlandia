# Local idea sharing — ODD

Reviewed against `world/civilization/ideas/local.js`, `test/local-ideas.test.js`
and `world/collective-mind/diffusion-tag.js` for SHE-715, November 17, 2026.
This documents the existing independent toy model; the prediction UI adds no
simulation mechanics.

## 1. Purpose and patterns

Explore bounded local sharing on synthetic fixed positions. Compare sharing
with a matched no-sharing control. This is not calibrated human diffusion.

## 2. Entities, state variables and scales

Residents have unique string IDs and explicit x/y coordinates in illustrative
meters. Informed residents retain their first adoption event. Tick zero holds
one origin; one tick is a synchronous contact round. Events retain ID, source,
receiver, tick, distance, adoption draw, hop count and parent event ID. These
identities and ticks are independent of Population and Collective Mind.

## 3. Process overview and scheduling

Sort IDs lexically, build immutable peers within inclusive radius, snapshot
informed residents at each round, then scan sources and peers in canonical
order. Only prior-round holders transmit. A recipient's first successful source
wins. Append counts after the round. No movement, remix, fading or broadcast.

## 4. Design concepts

Local contact and stochastic adoption generate reach. No objectives, adaptation,
learning, strategic sensing or collectives exist. Interaction only spans peers.
Counter-based Population `draw(seed, i*N+j, tick, 0)` is less than probability
for adoption. Observation is full event history and informed counts. User
predictions are external scoring and never inputs to adoption.

## 5. Initialization

`runLocalIdea` validates 1–512 unique residents, finite positions, existing origin,
uint32 seed, 0–1000 ticks, nonnegative finite radius, probability in [0,1] and
boolean sharing. Defaults: seed 42, 20 ticks, radius 10m, probability .65,
sharing enabled. Origin event 0 has null parent/source and hop zero.

## 6. Input data

Positions are explicit synthetic inputs. The recipe retains all inputs plus
`local-idea.v1`, `radius-sharing.v1`, `synthetic-fixed-positions.v1` and idea label
`drainage-policy-changed`. Labels are authored flavor. The Tag demo pins Ada
(0,0), Bo (8,0), Cy (0,8), Dee (16,0), origin Ada, radius 8, probability .65,
seed 42 and tick-zero checkpoint. No measured observations enter this scenario.

## 7. Submodels and invariants

Euclidean distance defines peers; .65 is an assumed probability. A directed
contact's keyed draw determines adoption. Parent event receiver equals source;
parent tick is earlier; receiver is informed once; distance never exceeds
radius. Control shares positions, seed and all parameters except sharing=false.
`validateLocalIdea` compares the full retained report to deterministic execution.
Tag copies and deeply freezes tick zero, verifies model/rules and replay, runs
exactly one tick, and checks a stored expectation before displaying results.
Missing evidence or mismatch is unavailable; cancel executes no additional tick.

Checks: `bun --no-env-file test test/local-ideas.test.js test/diffusion-tag.test.js`.
