# Exploratory agent civic model — ODD

The model description follows the ODD (Overview, Design concepts, Details) protocol (Grimm et al. 2006, updated 2010 and 2020). See [scope and review rules](README.md). Reviewed against the repository sources on 2026-11-12; retain the checkout revision with any run.

## 1. Purpose and patterns

Compare illustrative policy delivery pathways. Although labeled agent-based by the implementation, this is a synthetic heterogeneous population reduced to averages; individual agents do not interact or change state during the run.

## 2. Entities, state variables and scales

[agent-simulator.js](../../world/agent-simulator.js) creates households (resources/mobility/risk/support), developers (capital/risk/capacity), municipalities (capacity/cooperation), lenders (risk/liquidity), agencies (capacity/execution). Defaults are 500/40/12/8/5. No spatial network exists; values are dimensionless proxies, steps are years.

## 3. Process overview and scheduling

createAgentPopulation runs once; simulateAgentCivicDynamics loops year 1 through rounded horizon (default 10). Each year computes agency, compliance, finance, developer capacity, friction, shock, rollout, projects, supported households, delivery, updated support and score, then emits threshold events and timeline. Only aggregates accumulate; agent attributes stay fixed.

## 4. Design concepts

Basic principles: synthetic capacities constrain rollout. Emergence is limited to aggregate feedback in support and cumulative projects. Adaptation, learning, individual objectives/prediction, sensing and direct agent interaction are absent. Stochasticity occurs only at initialization using derived-seed Mulberry32. Collectives are type arrays reduced by means. Observation consists of yearly rounded proxies, event thresholds and final metrics; riskTolerance/mobility/execution fields are generated but unused by the outcome equations.

## 5. Initialization

Seed is deriveSeed(world.seed ?? world.id ?? 0, "agents"). Traits are uniform draws transformed to the ranges in createAgentPopulation; they are assumptions rather than survey distributions. Retain world normalized inputs, experiment horizon and agentPopulation options; no checkpoint continuation API exists.

## 6. Input data

Normalized scenario values use finite supplied values clamped to 0–1 or per-variable defaults. There are no observed external time series. Disruption is a constant product of disruption probability and climate stress, not a newly sampled annual disaster.

## 7. Submodels

Agency = agency_capacity × mean agency capacity; compliance = local_compliance × mean municipal cooperation; finance = credit_availability × (1-interest_rate) × mean liquidity. Projects = developer count × mean capacity × mean capital × finance × rollout × (1-friction) × (1-shock). Rollout = clamp(year/horizon × agency × compliance × funding_delivery_rate). Supported households = projects × 8 × (0.5 + 1-mean resources); support becomes clamp(.75×prior + .2×delivery + .05×(1-shock)). The factor 8 and score weights (.45 delivery, .25 support, .2 inverse friction, .1 inverse shock) are uncalibrated assumptions. Final housing cost is a bounded index response, not rent dollars. Reproduce by calling simulateAgentCivicDynamics with identical arguments/version. This model ID hbl-agent-civic.v1 differs from the default civic-dynamics adapter in model-registry.js. Verify: `bun test test/simulation-adapter.test.js`.
