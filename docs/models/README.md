# Social model descriptions and review

These descriptions follow the seven elements of the [ODD 2020 protocol and author guidance](https://jasss.soc.surrey.ac.uk/23/2/7/S1-ODD.pdf): purpose and patterns; entities/state/scales; process/scheduling; design concepts; initialization; input data; submodels. They document implemented behavior, including exploratory and game rules. They do not establish empirical validity. Assumptions belong beside the initialization, input or mechanism that uses them, not solely in a global disclaimer.

## Model inventory

| State authority or independent model | Description | Normal entry point / scope |
| --- | --- | --- |
| World Population | [Population and House](population.md) | Population runtime/worker; House, children, employment, firms, relationships, promises, traditions and life systems share this authority |
| Monthly City | [City](city.md) | City Lab API/worker; Future Machine reuses City rather than introducing a new model |
| Legacy World | [Legacy](legacy.md) | createWorld in world/sim.js; legacy relationship/culture/weather adapters |
| Agent civic prototype | [Civic](civic.md) | simulateAgentCivicDynamics; aggregate outcome calculation over fixed synthetic agent traits |
| Recorded-contact diffusion | [Ideas](ideas.md) | How Ideas Spread saved-Population overlay |
| Network opinion dynamics | [Collective Mind](collective-mind.md) | runCollectiveMind and versioned URL recipe |
| Authored bar social game | [Bar](bar.md) | Honey Pot command model, including externally supplied judgement boundary |
| Party NPCs | [Party](party.md) | Act Normal authoritative server room and commands |
| Synthetic pair-transfer fixture | [Energy transfer](energy-transfer.md) | Agent-count benchmark; not an empirical social simulation |

Inventory boundary: an agent model maintains individual state and applies behavioral rules or interactions. A file named model.js is not necessarily an ABM. Decision Studio housing (including frozen legacy versions) is an aggregate stock/flow model, documented in world/models/housing/README.md; civic/sim.ts is aggregate policy-to-metric interpolation. Risk Universe is an asset-path Monte Carlo model. Weather and culture are environmental/aggregate submodels documented with their hosts. Particle physics is not a social model. Family history, civilization zoom/perspectives, journals, timeline braids, hidden systems, what-if, future journey and invention/laboratory views inspect, compare, narrate or orchestrate existing records/runs; they do not acquire another resident-state authority by displaying people. Replay/counterfactual engines reuse the selected model. Add any new independent social mechanism here, even if it is experimental or not integrated into World.

## Before a model change lands

Author and reviewer must use this inventory for changes to rules, coefficients, generation, clocks, RNG, identity, inputs, retention or model dependencies, including optional submodels:

1. Read the affected ODD alongside the changed executable code and relevant tests. Check all seven elements; verify schedule/order, units, state ownership, initial conditions, draws and formulas. Follow linked subsystem contracts as part of the description.
2. Update the description in the same change, stating each new/changed assumption at its point of use. Add a description and inventory entry for a new model. If behavior is unchanged, record why the existing description remains accurate.
3. Record versions, exact initial state/source, scenario inputs, seeds, commands and time partition needed for reproduction. Keep observations, synthetic assumptions, model results and narrative separate. Require explicit mappings across identities/clocks.
4. Run the affected replay/invariant/failure-path checks and record actual results. Compare matched-seed runs where relevant. A seed alone does not reproduce external judgement or human/server input.
5. Reviewer records in the PR the description path, code paths checked, discrepancies resolved and verification evidence before approval. Do not approve a model change with a known code/description mismatch.

The repository PR template and AGENTS.md make this a review requirement. They cannot prove that a human completed a review or replace repository branch-protection settings. No hosting/production policy is changed by these documents.

Reproduction uses the pinned implementation and the documented inputs; these compact ODD descriptions link the exact source and detailed module contracts for full parameter catalogs. Do not interpret an unversioned later checkout as the original rules.
