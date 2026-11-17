# Recorded-contact idea diffusion — ODD

The model description follows the ODD (Overview, Design concepts, Details) protocol (Grimm et al. 2006, updated 2010 and 2020). See [scope and review rules](README.md). Reviewed against the repository sources on 2026-11-12; retain the checkout revision with any run.

## 1. Purpose and patterns

Explore hypothetical adoption/remix/fading on retained synthetic Population conversations. Reach is a modeled overlay; contacts are recorded inputs, not empirical social observations.

## 2. Entities, state variables and scales

Agents are original Population resident IDs; active holders have original/remix variant and expiration minute. Contact records retain participant pair, ID, minute and evidence. Time is Population minutes; no invented geography or new resident identity.

## 3. Process overview and scheduling

[simulateIdeaSpread](../../world/civilization/ideas/model.js) introduces the idea at the first retained contact involving starterId. For each contact at/after start, expire holds at the new minute, test whether exactly one participant holds the idea, then draw adoption and optional remix. New adopters cannot transmit until the next minute. Expire through checkpoint end and sort output events by minute.

## 4. Design concepts

Basic principles: contact-mediated transmission with finite retention. Emergence: reached set and active holders depend on contact topology. Adaptation/objectives, learning/prediction and strategic sensing are absent. Interaction is pairwise contact only. Stochasticity uses seed/contact-ID/direction/minute keyed draws from Population contracts. Collectives are absent; variants are labels rather than organizations. Observation records introduced, declined, adopted and faded events with source evidence.

## 5. Initialization

Validate nonempty title of at most 80 characters, uint32 seed and starter with a retained contact. Initialize only that resident holding original. Active/reached/event collections are rebuilt for each run. Retain recipe version population-idea-diffusion.v1, immutable experiment ID, title, starter and seed.

## 6. Input data

The [source adapter and entry point](../../world/civilization/ideas/README.md) project accepted talk commands and hotspot encounters from a saved checkpoint, bounded to 512 contacts. Ordering, exact contact IDs/evidence and throughMinute matter. Missing contacts are not inferred and the overlay does not mutate the source save.

## 7. Submodels

IDEA_RULES assumes adoption probability .65, remix probability .2 conditional on original transmission, and retention 1440 minutes. These are synthetic constants, not estimated rates. Already-active pairs do not refresh retention; faded residents may adopt again. Remix does not remix further. Reproduce from the same saved contact projection and recipe. Verify: `bun test test/idea-diffusion.test.js`.
