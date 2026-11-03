# Date adventures (additive descriptor)

`createDateAdventureSystem()` from `date-adventures-system.js` registers `id: 'date-adventures'`. Install after dates, before cinematic observers. Saved state is `home.systems.dateAdventures` (48,000-byte cap). It reads the existing actual pair/date clock; it never creates residents, transports people, ends dates, invents edible inventory or grants canonical money/skill/romance from a narrative choice.

Commands use household system wrapper `system:'date-adventures'`, current `dateId`, stable bounded `commandId`:

- `start {scenarioId, otherPersonIds?, consentingPersonIds?}`: select an authored optional scenario. `double-date` requires another existing, actually colocated date pair and all four agreements.
- `ask-partner`: get source-labelled actual need/preference response for the current stage. Each choice stage needs this contribution before choose.
- `choose {optionId}`: current authored option only. No arbitrary narrative text, progress, score or outcome payload.
- `abandon`: quietly exit the optional scenario, with no completion reward.
- `discover {places:[DatePlace]}`: max 12 validated actual supplied places, within 800m of actual outing. No fake POIs. Needed for surprise's two destinations and rain café branch.
- `home-practice {unlockId}`: returns `requiresReview:true, proposedHouseAction`. It does not execute or reward the action.

`inspect` exposes `{active:{dateId,personIds,locations,offers,scenario,available,reason,quietUntilMinute,partnerObservation},cast,couple,history,events,homePractices,capabilities,unsupported}`. `scenario` has `{id,scenarioId,title,status,stageIndex,stages,stage,choices,details,evidence,outcome,partnerAnswer}`. `stage` has `{id,prompt,type:'choice'|'evidence',options:[{id,label}],requires?,status,progress}`. A choice can return `plan` and save `details.plan`; plans are always subject to review and must execute through normal dates/house commands. For surprise and café use `details.proposedPlace`; do not silently execute travel.

Evidence kinds: `activity` (`activityIds`), `movement` (`distanceMeters`, both actual walkers), `destination` (ordinary planner arrival), `photo` (acknowledged saved photo + shared recorded frame), `game` (validated bounded actual inputs and attended time), `home-meal` (real canonical sharedDinner), `double` (both existing pairs complete fresh talk together). Partial, pre-stage, absent, reused and click-only actions cannot finish stages.

`couple` exposes earned `unlocks` (each supplies `proposedHouseAction`), digital `gifts`, composed `greeting`, design proposal `designSpace`, persistent `project`, 3-outing `stories`, and recorded `observations`. Observations explicitly identify authored partner perspective based on actual choices/evidence, not fabricated secret biography. `cast` has exactly 3 explicitly fictional recurring characters with actual-date visit counts.

Descriptor also registers genuine core `actions.dateHomeTogether`: 30-minute paired home practice, exactly two actual admitted home people, `systemOptions:{unlockId}`, no active date assignments. Earned unlock pair must match. Proposal includes existing couch objectId when available so ordinary core capacity/reservation applies. Core action progress/schedule/interruptions remain authoritative; only actual full completion records `home-tradition-practiced`. This creative practice creates no edible meal or canonical skills. Renderer may animate the action separately.

Events: `{id,type:'adventure-started'|'adventure-completed'|'adventure-abandoned'|'home-tradition-practiced',dateId,personIds,minute,text,adventureId?,scenarioId?,outcomeId?}`. Globally unique house journal IDs remain owned by recordEvent; local IDs are `adventureEventId`. `adventure-completed` is emitted once, after genuine objective evidence, and recorded through existing date memory/inside-joke hooks.

Rain is an optional **fictional vignette**, not a claim of current observed weather or a weather mutation. Cake is a fictional prop. Gifts/space/project are honest saved digital artifacts and proposals. Physical meshes, custom animations and second-human controls belong to the separate scene/control layer. No unimplemented bus/ingredient/stall physics is advertised.
