# Date recipe integration

Factory `createDateRecipeSystem()` in `date-recipe-system.js`; registry ID `date-recipes`; register after dates. State is `home.systems.dateRecipes`, version `date-recipes.v1`. No additional person registry, timers, reward wallet or date-ending authority.

`date-recipes.js` exports `DATE_RECIPES` (30), `DATE_RECIPE_VARIANTS` (four), `DATE_RECIPE_RULES`, `dateRecipeDefinition(id)`, and pure prestart `recommendDateRecipeCards({places,people,personIds,history,minute,budget})`. Preview returns five rows `{recipe,recipeId,title,available,supported,reasons,matchingPlaces,plannedSpine,opportunities,minimumActivityCost,proposalOnly:true,why}`. Places must be actual supplied places. Preview eligibility is provisional; actual active pair, consent, relationship, clock, affordances and household funding are authoritative after start. Existing four fixed destination presets are untouched.

`date-recipe-system.js` exports `recommendDateRecipes(model,home)` (five canonical active-date cards), `suppliedRecipePlaces(model,home)` and factory. Nearby radius is 2,500m in one coordinate space: validated global places never mix with unrelated city-local positions.

## Commands

Send through `applyHouseholdSystemCommand` with householdId and system:'date-recipes'. Every command needs actual `dateId` and nonempty unique `commandId` (max160). Identical retained receipts replay once; changed payload under an existing ID rejects.

- `{type:'plan',recipeId,rules?}` — select actual available recipe or variant.
- `{type:'next',chooserId?,placeId?}` — return `result.proposedCommands`, `selection`, `requiresActualExecution:true`, `requirements`. Commands target existing system:'dates' venue/activity/depart. Execute travel first, await actual arrival, then any activity; do not dispatch all sequential commands immediately. A saved-photo anchor explicitly requires existing capture/persist media flow, not merely photography activity.
- `{type:'rules',rules}` — replace rules. Budget is actual whole date ledger, not a reset allowance.
- `{type:'propose',slot:'major'|'small'|'partner'|'surprise'|'conversation'|'quiet'}` — bounded opportunity proposal only; major includes actual offered `questOptions`, never creates free quests/events.
- `{type:'derail',placeId}` — actual nearby detour proposal and preference-grounded response; keeps date open.
- `{type:'resume'}` / `{type:'abandon'}` — plan lifecycle only, no failure or ending date.
- `{type:'open-envelope'}` — requires actual shared presence at/after 20:00 game clock. Three walking/conversation/saved-photo evidence stages.
- `{type:'recreate',recordId,rules?}` — actual retained completed pair date only; old stops must currently be supplied/revalidated. Callback retains source record/moment IDs. Oldest retained history is not represented as proven first-ever date.

Rules: `{budget:number0..100000,chooser:'player'|'partner'|'take-turns',photoGoal:integer1..10,newPlacesOnly:boolean,noRepeatActivities:boolean,noPhones:boolean,noMap:boolean,sayYes:boolean,tryNew:boolean}`. Last four are honestly not-verifiable; phones/maps/exhaustive reasonable quests/lifelong novelty are not instrumented. Chooser controls recipe proposals, not free-roam player actions. Turns advance only after new actual matching activity/arrival evidence.

## Inspector

`{schemaVersion,minute,recommendations,catalog,variants,active,ruleDefinitions,ruleProof,partnerProposal,history,places,source}`. Catalog/variants include availability/reasons and plan command. `active` includes stable id/dateId/personIds/recipeId/title/status, anchors `{id,type,activity?,kinds?,count,evidenceIds,status}`, progress, rules, limitations, pacing, selections, envelope, optional callback, and command-bearing `options`. `active.pacing.options` and nearby `places[].command` are directly actionable. Partner proposals derive current actual traits/preferences/energy, without invented biography.

Pacing maximums: major1, small2, partner1, surprise1, conversation2, quiet1. These are proposal limits, not fabricated percentage guarantees. Completion means spine-observed, records one actual canonical scrapbook moment, and leaves the date open. No relationship/cash awards. Canonical completed activity receipts require full actual attended duration; photo goals require actual acknowledged media and shared first-observation eligibility. Driving requires real route source/duration and actual completed drive evidence. Route execution/pricing remains existing date runtime authority.

Train boarding, date cooking/ingredients, actual outfit exchange, date board games, escape room and volunteering remain unavailable with explicit reasons. Fireworks, birthday gifts, strangers, dishes, prizes, elevation and childhood history are never promised from place labels. Impossible Date chooses three feasible recorded activity/photo objectives. Birthday requires retained actual birthday event; rain requires actual weather; close/established premises use existing canonical relationship/history.

Retention: one active plan, history8, receipts24 (trimmed further above44KiB), bounded proposal/selection/evidence ledgers; validation ceiling48KiB. Inspect is read-only, interval replay does not advance twice, serialize/reload preserves plan/evidence. No private timers.
