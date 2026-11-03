# Date quest integration contract

`createDateQuestSystem()` registers ID `date-quests`; persisted state is `home.systems.dateQuests`. It owns no population, clock, city locations, inventory, travel or renderer. Root installs after `dates` and before `date-cinema`.

Public inspector: `{schemaVersion, active, hosts, history, events, projections, canonicalRelationship, relationshipContacts, unsupported}`. `active` is null without a date; otherwise:

- `{dateId,personIds,phase,locations,hosts,offers,quest,decision,quietUntilMinute}`.
- `locations`: normalized actual DatePlaces, including current selected place and explicitly discovered OSM POIs.
- `hosts`: `{id,name,role,archetype,fictional:true,placeId,place:{id,name,kind,lat,lng,x,z},visits,greeting}`. These are explicitly fictional story hosts, never population residents. A stable place/archetype identity recurs; visits are tracked per actual couple/date.
- `offers`: `{id,title,family,hostId,placeId,placeName,summary,stages,playerOptions,status,availableAtMinute,partnerAnswer?}`. Families are `explore`, `cooperate`, `social`, `competition`, `romantic`. Stages: `{id,label,type,status,evidenceId?}`. Player options: `{id,label}`.
- `quest`: null or `{id,offerId,title,family,hostId,placeId,personIds,status,acceptedMinute,stageIndex,stages,playerOptions,partnerAnswer,playerChoice,completedMinute?,outcome?}`. First stages are actual partner consultation and player choice; remaining objectives require actual evidence. No complete/progress command exists.
- `partnerAnswer`: `{text,choiceId,source,memoryId?}`. It uses actual canonical traits/preferences and retained memories only.
- `decision`: includes canonical-preference `partnerPlaceId` and actual-memory `partnerAnswer`; null or `{id,method,status:'review'|'approved',stops:[{placeId,name,reason}],reason,approved}`. This is a proposal for review; approval never transports people or starts an activity.

All commands receive outer `{householdId,system:'date-quests'}`. Inner commands require stable `commandId` and actual active `dateId`:

- `{type:'discover',places:[versionedDatePlace]}`: max 24 validated OSM places within 800 metres of the current actual geographic date place; no rewards or population/location-array mutation. Root syncs provider-verified renderer places once per date/place digest.
- `{type:'accept',offerId}`.
- `{type:'ask-partner',offerId}` before acceptance, or `{type:'ask-partner',questId}` after acceptance.
- `{type:'choose',questId,optionId}`: one of quest.playerOptions, never a score or progress value.
- `{type:'defer',offerId}` / `{type:'decline',offerId}`.
- `{type:'abandon',questId}`.
- `{type:'decide',method:'compromise'|'insist'|'partner-choose'|'coinflip',playerPlaceId,partnerPlaceId}`.
- `{type:'approve-plan',decisionId}`.

`events` rows: `{id,type,dateId,personIds,minute,text,questId?,family?,hostId?,placeId?,evidenceIds?}`. Types include `quest-offered`, `quest-accepted`, `quest-stage`, `quest-completed`, `quest-abandoned`, `shared-plan-proposed`, `shared-plan-approved`. Cinema observes these read-only. Global events use canonical unique event IDs; local IDs are namespaced metadata.

Quest evidence comes exclusively from actual completed date activities, validated minigames and their command receipts, acknowledged stored photos, and completed shared walking events. Activities/games require both actual participants and actual elapsed attendance. Choices alone yield no rewards. Existing core activity rewards remain owned by their existing systems. Quest completion adds bounded couple projections and at most one evidenced canonical trust point, once; records a specific memory through `recordDateMoment`, and uses existing inside-joke discovery for actual playful game conclusions. No invented collectibles or ingredient inventory.

Initial offers wait two simulated minutes; conclusions/defer/decline create quiet cooldowns. No popup or private clock. State is bounded below 60 KiB, with 32 bounded per-date receipts and explicit rejection rather than evicting replay protection. Inspector omits receipts and full evidence cursors. `validate` checks persisted shape, ownership and bounds; save/reload continuation is deterministic.

A final activity finishing exactly when the core date lifecycle ends may be proved from the archived core completion ledger plus its canonical event. That completion receives quest projections/memory but no late trust change after the canonical date recap closed. A photo objective also requires a retained recorded frame showing both actual participants together at capture time.
