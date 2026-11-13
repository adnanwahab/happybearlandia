# Bounded energy-transfer reference fixture — ODD

The model description follows the ODD (Overview, Design concepts, Details) protocol (Grimm et al. 2006, updated 2010 and 2020). See [scope and review rules](README.md). Reviewed against the repository sources on 2026-11-12; retain the checkout revision with any run.

## 1. Purpose and patterns

A synthetic individual-update benchmark for validating count/provenance claims, included to distinguish it from calibrated social models. It cannot establish million-agent performance.

## 2. Entities, state variables and scales

[agent-counts.js](../../world/metrics/agent-counts.js) owns stable integer resident IDs and energy; optional aggregate weight is an annotation. Ticks are discrete iterations with no physical time. Wall throughput is a separate measurement.

## 3. Process overview and scheduling

Initialize residents, then choose one ordered distinct pair per tick; transfer one unit if donor has energy. Empty donors generate no transfer event. Validate by replay and regenerated seed-matched schedule before exporting claims.

## 4. Design concepts

Basic principles: conservation. Emergence: energy distribution only. Adaptation, objectives, learning, prediction and sensing absent. Interaction: directed pair transfer. Stochasticity: versioned LCG pair selection. Collectives absent. Observation: before/after event evidence, counts and separate elapsed wall duration; visible avatars are zero and render FPS unavailable.

## 5. Initialization

Every resident starts at energy 10. Fixture caps 4096 records and 1000 ticks. Retain uint32 seed, sizes and model/rules/source/adapter versions from the [count contract](../agent-counts.md).

## 6. Input data

No real input observations. Uniform/modulo pair selection and initial energy are synthetic assumptions; elapsed wall time depends on the machine and will not replay numerically.

## 7. Submodels

LCG uses multiplier 1664525 and increment 1013904223 modulo 2^32. Nonempty donor loses one and recipient gains one, conserving nonnegative total energy. Distinct changed IDs differ from event count. [Count contract](../agent-counts.md) specifies exact validation and unavailable-rate behavior. Verify: `bun test test/agent-counts.test.js`; run `bun scripts/benchmark-agent-counts.js 4096 1000 42` for a bounded measurement.
