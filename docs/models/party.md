# Act Normal party agents — ODD

The model description follows the ODD (Overview, Design concepts, Details) protocol (Grimm et al. 2006, updated 2010 and 2020). See [scope and review rules](README.md). Reviewed against the repository sources on 2026-11-12; retain the checkout revision with any run.

## 1. Purpose and patterns

A multiplayer hidden-objective game with scripted NPC guests. It tests gameplay behavior, not real deception or social inference.

## 2. Entities, state variables and scales

[act-normal-model.js](../../world/party/act-normal-model.js) owns twelve guest actors, 2–8 connected human players, props, private missions, accusations and bounded receipts/events. Actors store local position, heading, target, carried object, interaction/hold and decision time. Server time is milliseconds; floor bounds are x ±7 and z ±5 meters.

## 3. Process overview and scheduling

Commands validate server-owned state. advanceActNormalRoom ignores non-increasing time; increments tick in a round, expires holds, completes eligible interactions, runs NPC decisions for nonconnected-human actors, moves actors, resolves dance arrival and carried props, then evaluates blocked objectives and round end. Movement dt is capped .25 seconds: exact timestamp/tick partition matters for replay.

## 4. Design concepts

Basic principles: timed interactions and prop exclusion. Emergence: resource contention and gameplay outcomes. Adaptation/objectives: NPC scripted branches depend on carried items and availability; humans pursue assigned missions. Learning/prediction absent. Sensing uses room objects/actors and proximity. Interaction reserves shared actors/props. Stochasticity uses seed, round, actor and tick hashes, with server secret ordering for role/mission assignment. Collectives are a room, not inferred social groups. Observation: public state excludes private roles until results; receipts distinguish human/NPC source.

## 5. Initialization

createActNormalRoom requires six-character code, reconnect token, authoritative time and bounded round duration (10–180 seconds). start rebuilds guests/props and assigns roles/missions. Retain seed, server ordering inputs, joins/connectivity, commands and timestamps privately; seed alone cannot replay a human session. Never publish tokens/secrets as reproducibility artifacts.

## 6. Input data

All guests/props and missions are authored. Human actions and server timestamps are external inputs; there is no empirical behavioral dataset. NPC behavior for disconnected players is an explicit gameplay assumption.

## 7. Submodels

Interaction range is 1.35m with 3000ms completion delay; movement speed is 1.9m/s. NPC decisions use hashed delays of 2500–7499ms and branches for gifts, letters, cake, dance and exit. Mission credit requires actual human-sourced interaction evidence. Score is mission 100 plus correct accusations 15, false accusations -10 and caught penalties -20 capped at -40. These are authored utilities, not social welfare. Verify commands/clock/privacy with `bun test world/party/act-normal.test.js world/party/act-normal-client.test.js` (the WebSocket integration requires permission to bind a local port). Retain exact server inputs for reproduction.
