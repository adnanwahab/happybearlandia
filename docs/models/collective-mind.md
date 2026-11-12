# Collective Mind opinion dynamics — ODD

The model description follows the ODD (Overview, Design concepts, Details) protocol (Grimm et al. 2006, updated 2010 and 2020). See [scope and review rules](README.md). Reviewed against the repository sources on 2026-11-12; retain the checkout revision with any run.

## 1. Purpose and patterns

Explore how network connectivity and openness affect synthetic agreement. Consensus and polarization are illustrations rather than predictions of voting or public deliberation.

## 2. Entities, state variables and scales

[model.js](../../world/collective-mind/model.js) uses 1000 indexed agents in eight communities of 125. Each holds one of three preferences and a fixed initial private prior of weight 1–2. Undirected graph edges define communication. Time is 60 synchronous rounds, without a calendar mapping.

## 3. Process overview and scheduling

runCollectiveMind builds a network and initial state, then each round reads only the previous frame. Each agent sums one vote per neighbor plus its fixed private prior. It adopts a unique winning option with probability openness, otherwise retains its previous preference; ties retain current choice. Store a frame and statistics after every round.

## 4. Design concepts

Basic principles: local influence plus persistent prior. Emergence: network-wide support and agreement. Adaptation/objectives: preference follows a local weighted winner, without welfare optimization. Learning/prediction absent. Sensing: neighbor preferences only. Interaction: static graph votes; no new ties or reciprocal bargaining. Stochasticity: keyed Population draw function for graph shuffle, initial preference, prior and per-round adoption. Collectives: fixed communities affect initialization/topology, not separate agents. Observation: full counts, largest option share, same-preference edge fraction and changed-agent count. Rendering samples edges only; metrics use all edges.

## 5. Initialization

normalizeMindRecipe defaults seed 42, bridges network and openness .65. Initial community favorite is community index modulo 3, chosen with probability .56; either other option has probability .22. Private weights are 1+draw. All values are synthetic assumptions. Recipe version collective-mind.v1 and exact source revision pin rules.

## 6. Input data

No external data. Recipe retains seed, network, openness, question and three distinct option labels. Labels do not change utility; wording is not processed semantically. [Entry point](../../world/collective-mind/README.md) explains URL replay.

## 7. Submodels

District networks connect offsets 1–3 around each community ring; bridges adds eight links to the next community. Citywide shuffles all IDs then connects offsets 1–4 in one ring. Duplicate/self links are excluded. Summaries compute option counts, max(count)/1000 and agreeing edges/edge count. runCollectiveMind(recipe) reconstructs all frames deterministically. Verify: `bun test test/collective-mind.test.js`.
