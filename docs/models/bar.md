# Honey Pot social game — ODD

The model description follows the ODD (Overview, Design concepts, Details) protocol (Grimm et al. 2006, updated 2010 and 2020). See [scope and review rules](README.md). Reviewed against the repository sources on 2026-11-12; retain the checkout revision with any run.

## 1. Purpose and patterns

An authored social game about conversations and reactions, included conservatively as an individual-based social model. Humor scores are gameplay rules, not psychological measurements.

## 2. Entities, state variables and scales

[bar-model.js](../../world/bar/bar-model.js) defines fixed adult patron profiles, humor preferences and groups. Per-patron mutable state tracks vibe, drinks, cold/number/gossip flags; player state tracks cash, tipsiness, strikes, lines, minutes and ending. No spatial dynamics; time advances in action-cost minutes until closing.

## 3. Process overview and scheduling

Commands sayLine, buyDrink, buyGossip, askAvailability, shootShot and leaveWith validate eligibility and resources, mutate state and spend declared time; spend clamps to closing and ends the night. There is no autonomous patron tick. Preserve command order and exact text.

## 4. Design concepts

Basic principles: authored preferences plus rule-based reactions. Emergence is bounded to command-dependent scores/endings. Adaptation/objectives: human player chooses; patrons react through fixed rules. Learning: duplicate-line memory only, no learned policy. Prediction/sensing: no patron foresight, only supplied line and state. Interaction: directed/group conversation and purchases. Stochasticity: deterministic text/patron hash variation, no PRNG seed. Collectives: authored groups. Observation: bounded log, score and endings, with authored replies distinct from empirical evidence.

## 5. Initialization

createBarState initializes version 1, authored opening time/cash, zero tipsy/strikes and group-dependent initial vibe (30 vs 35). Save initial state and ordered commands; source revision pins profile and regex catalogs.

## 6. Input data

Profiles, drinks, regex styles and suggested lines are authored. Optional externally supplied judgements enter sayLine; retain those exact judgements and source to reproduce an AI-assisted session. Local fallback judgement is deterministic and does not reproduce arbitrary remote model responses.

## 7. Submodels

judgeLine rejects creepy patterns, penalizes normalized duplicates/short text, matches humor styles and combines best patron preference, line shape, hash luck and playerSway into a clamped 0–10 integer. Purchases and advances use fixed costs and thresholds in the same module; these do not model alcohol physiology or real consent/attraction probabilities. Reproduce with identical commands and supplied judgements. Verify: `bun test world/bar/bar-model.test.js`.
