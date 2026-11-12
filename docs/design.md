# HappyBearLandia product design

HappyBearLandia lets people explore cities, households, businesses, and alternative futures. A visitor starts with a place or a character, proposes a change, runs plausible futures, and examines how the model produced each outcome. A shared link should let someone else reproduce the same scenario and inspect its evidence.

## Core journey

1. Open a real location or a clearly labeled synthetic scenario and inspect a building, district, household, or business.
2. Change a policy or assumption with visible units, cost, timing, and modeled constraints.
3. Run alternatives from a common starting state. Use matched seeds for comparisons and show the spread across runs, including missing outcomes.
4. Enter a selected future and navigate to the same place and simulation time in World and Worldline where the model supports it.
5. Follow a result back to a recorded observation, dependency, policy, or assumption. Adjust the proposal and rerun.

## Application surfaces

| Surface | Product role |
| --- | --- |
| World and Time Machine | Explore geographic context, view changes by month, select an entity, and jump from a headline to the corresponding recorded checkpoint. |
| Worldline and Decision Studio | Configure and compare scenarios, inspect uncertainty, and replay a selected future. |
| FlowMap and Living Network | Inspect modeled flows and dependencies across people, money, goods, energy, water, and infrastructure. A category requires a supported model and evidence. |
| House Simulator | Explore households, relationships, and consequences for specific residents. Links across applications require a verified identity mapping. |
| Business Simulator | Explore firms, employment, markets, costs, and supply dependencies. |
| Causal Inspector | Explain recorded events using model inputs, decisions, assumptions, and evidence. Keep narrative interpretation identifiable. |
| Living City and Council | Present requests from simulated people and institutions, test policy changes, and show stakeholder responses through inspectable rules. |

## Data and architecture

Share versioned records and read interfaces across surfaces. Each simulation retains its own state authority. The monthly CityState, World population runtime, and Decision Studio housing model have different clocks and entity identifiers. An adapter must demonstrate how an entity and time map before combining results.

A reproducible run identifies its model and rules versions, starting state or source, seed, parameters, units, and interventions. Store event history and checkpoint references as required for inspection and replay. Keep parents immutable when branching. Use a small versioned recipe for shareable deterministic scenarios and keep checkpoints when exact recorded state is required. A missing checkpoint, unsupported metric, or model version mismatch needs an explicit state in the UI. Distinguish a recorded snapshot from a recomputation and verify replay against independently stored evidence when claiming equivalence.

Use real geography with source attribution and clearly identify synthetic properties attached to it. Explain what data, uncertainty, and mechanisms support a result. A difference between futures is a model result. A causal claim needs the recorded dependency or a controlled comparison and its assumptions.

The repository currently uses Bun and JavaScript modules, Three.js for 3D surfaces, Web Workers for simulation work, SQLite and file-backed persistence, and WebSockets on existing multiplayer surfaces. Evaluate TypeScript adoption or additional WebGPU work when a specific feature requires it.

## Housing policy vertical slice

The target journey is a housing proposal followed by ten modeled years, a paired comparison, inspection of the city at a selected year, and an explanation of a housing outcome. Existing Decision Studio housing and World replay features are starting points for integration. The [implementation plan](implementation-plan.md#housing-policy-vertical-slice) tracks readiness.

Acceptance requires a supported proposal with documented cost and assumptions, repeatable runs from identical inputs, and comparison with a baseline using matched seeds. World and Worldline must agree on the selected scenario, date, units, and supported entity identities. A user must be able to jump to a recorded housing outcome, inspect its provenance, change an input, and rerun. Integration tests should verify that complete journey and a missing-data path.

## Time Machine roadmap

| Feature | Intended behavior |
| --- | --- |
| Universal Time Machine | Scrub stored city history, see changes by date, and jump to a recorded event. |
| Why Did This Happen? | Follow an event through recorded inputs and model decisions, with sources and limits visible. |
| Branch Reality and Future Diff Viewer | Apply one supported intervention from a selected checkpoint, run a matched control, and compare changes in maps and measured outcomes. |
| Follow a Life and Universal Entity Inspector | Follow a verified resident or entity through supported World, House, Business, and history views. |
| Living Newspaper and Surprising Discovery Engine | Surface consequential recorded changes and link each headline or finding to its exact evidence. |
| Butterfly Effect Explorer | Inspect how the effects of a single intervention propagate through supported dependencies over time. |
| City Heatmaps | Display measured or modeled district metrics with units, fixed comparison scales where appropriate, and a missing-data category. |
| Saved Futures Gallery and Multiplayer Scenario Lab | Share replay recipes first. Add persistent ownership, proposals, voting, and access controls as those contracts mature. |

The guided Riverside Bakery mystery starts in 2046. A visitor works backward from the closed bakery, examines the modeled effect on Luis, tests a road intervention, compares the futures, and shares the recipe. It is a focused synthetic scenario. Reuse the same approach for guided stories with evidence, bounded interventions, and repeatable outcomes.

## Living City roadmap

The first quest follows a Riverside resident’s commute. Visit the home, inspect the route, propose a supported transit improvement, run 100 paired samples, and revisit the same resident in a selected pair. Show both travel and budget effects. A share link reopens that pair using the recorded recipe version.

| Feature | Intended behavior |
| --- | --- |
| City Quests | Turn measured problems into requests from residents, businesses, and institutions. Start with five authored templates and extend to other playable challenges as interventions become available. |
| Living Network and Cascading Failure Mode | Inspect supported flows, identify dependent entities, and compare outcomes when a modeled connection or capacity changes. |
| Living City Council | Show stakeholder goals, votes, and coalitions. Extend explicit voting rules to modeled negotiation when its state and evidence are defined. |
| Policy Paintbrush | Select a location in the city, validate a spatial proposal, and commit it to a fork. |
| Counterfactual Interviews and Documentary Director | Explain differences using actual observations. Label any generated narration and link back to records. |
| Civilization Challenges and Public Experiment Arena | Offer reproducible objectives, budgets, and scoring across standardized seeds. Initial scenarios include flood resilience, housing access, and neighborhood business health. |
| Institution Builder, Factions, and Research Discoveries | Model staffing, budget, capacity, goals, group activity, and supported research outcomes through explicit rules. |
| Enter Any Neighborhood | Combine sourced map geometry with labeled synthetic city state and supported interiors. |
| World Health Dashboard | Present prosperity, housing access, environmental conditions, resilience, distribution, and uncertainty. |
| Persistent Personal Legacy | Preserve meaningful contributions and allow others to explore them under clear ownership and sharing rules. |

## Playable Life and emerging civilizations

The first playable life starts with a selected resident in a saved Living World. Open that resident in House Simulator and inspect their home, employment, schedule, needs, and available relationship and goal records. For one 24-hour window on the existing Population clock, direct the resident through five supported activities. Clean the living room, travel home, talk with a housemate, buy a plant, or rest. Show whether the simulation accepted each request and use the existing House and Population rules for time, movement, spending, and social interaction.

End the playable day and choose either 30 further modeled days or a synthetic season of 90 days under ordinary simulation behavior. The selected horizon locks when the handoff begins, including across pause and resume. Compare the resident's needs and household savings at the start and after the follow-up. Show the recorded events and decision evidence alongside links to the starting World checkpoint, the follow-up World checkpoint, and the saved resident report. Changes during follow-up describe the resident's observed trajectory. Estimating the effect of a particular action requires a matched control from the same starting checkpoint.

Record the resident's persistent entity ID, starting World/run identity, and control-window ticks. Save the follow-up as a child of the starting checkpoint and keep the saved report with the child. World and House use the same Population runtime identity and clock for this journey. Expanding playable lives to the monthly City model or Decision Studio requires an explicit mapping of resident, household, time, and action semantics.

The next priority after Playable Life is idea diffusion, followed by generational families, perspective comparisons, and resident-led experiments. Individual choices, collective coordination, and institutional inquiry can share events and evidence as their model interfaces mature.

| Feature | Intended behavior and dependency |
| --- | --- |
| Ideas That Spread Through Society | Trace transmission, adoption, mutation, and decay through recorded interactions. Start with one versioned idea on the existing social graph and preserve the event that supports each transmission. |
| Generational Families | Follow persistent household and kinship links through moves, changing jobs, and life events. Keep family relationships and dates consistent across saved checkpoints. |
| Rashomon Mode | Compare residents' perspectives on the same event. Show beliefs and interpretations alongside recorded outcomes and the evidence each resident had access to. |
| Simulations Inside Simulations | Let a planner or institution evaluate bounded alternatives with declared assumptions, then compare its prediction with the outcome of the city model. |
| Archaeology of the Future and Generated Mysteries | Investigate a change through recorded histories of places and entities. Assemble clues from shared simulation events and open the corresponding checkpoints and causal evidence. |
| Simulated Social Movements and Emergent Holidays & Traditions | Model how groups form and coordinate and how repeated observances become local customs. Build on explicit membership, contact, and event histories. |
| World Composer and Reality Debugger | Turn supported observations into audiovisual signals and give model authors tools to inspect invariant failures, contradictory records, and surprising results. |
| Future Search Engine | Query indexed saved futures by supported metrics, units, model version, and constraints. |
| Asymmetric Multiplayer | Give each role explicit authority over its own decisions in a shared scenario. Establish ownership, synchronization, and conflict rules first. |
| Browser Compute Swarm and Simulation Modding Studio | Establish bounded, versioned execution, consent and resource controls for contributed compute, and verification of results and extension behavior. |

## Agent Training Gym — later phase (SHE-192)

Give AI agents controlled environments with recorded trajectories, rewards, and evaluations. This is later-phase work and is not required for the next release. Implementation depends on an Experiment Registry contract that can retain and rebuild an immutable environment version.

Each environment must pin its model and rules, starting state, source data, dependencies, scenario inputs, seed, action and observation contracts, and execution limits. Record ordered actions, observations, reward components, termination reasons, and causal references against that version. Declare and freeze the reward definition before training starts; changing rewards creates a new experiment revision.

Report simulated evaluation and real-world evaluation separately, with provenance, sample counts, units, uncertainty, and limitations for each. Missing real-world evidence is explicitly unavailable and must never be inferred from simulated rewards. Training performance and held-out evaluation are also distinct results.

## Open questions

- Which housing model outputs can World render directly, and what mapping is needed for properties, residents, and dates?
- Which snapshots must be retained for exact replay when model versions change, and which scenarios can be rebuilt from a pinned recipe?
- What evidence and thresholds make a modeled change meaningful to a player, and what does a first-time player need to complete the guided journey?
- Which authorization and retention contracts are required before public submissions, persistent shared state, and multiplayer decisions?

## Research agent role

Operator-invoked research agents inspect supplied simulation rules and a pinned
Research Library snapshot, compare approaches, and propose experiments or
implementation issues. Their output enters the existing private improvement
inbox as drafts for human triage. Every claim links to a library entry or is
explicitly unsupported; metadata citations do not establish a mechanism.
Experiments declare a hypothesis, data sources and acceptance criteria. The
role never dispatches work. See [the role contract](../ops/research_agents/README.md).
