# Yark Green authored mystery

Register createDateMysterySystem() from date-mystery-system.js. Descriptor and persisted state id: date-mystery. No app, date renderer, scene, installer or UI changes are owned by this module.

Commands use existing householdSystemCommand with householdId/system:'date-mystery'. A stable nonempty commandId <=160 characters is required for exactly-once receipts. Inputs:
- begin {dateId,commandId}
- choose {dateId,nodeId,choiceId,commandId}
- recall-joke {dateId,commandId}
Unknown fields/long IDs reject. Reusing commandId with different payload rejects. Duplicate exact payload returns saved result without effects. Current nodeId is mandatory for choose; skipped or outdated nodes reject.

Inspector: {schemaVersion,eligible,reason,active,history,staging,heartBurst,authoredFiction,source}. active is null or {id,dateId,personIds,nodeId,title,text,choices:[{id,label}],clues,quoteIntroduced,quoteAttempted,correctQuote,startedMinute,authoredFiction:true,outcome}. choices are stable original-authored script rows. No server-generated biography or restaurant-staff claims. UI should retain an authored-game-fiction notice and render the actual date people/appearance.

Tree:
intro: study-envelope -> envelope; leave-case -> paused.
envelope: check-margin -> theory; leave-case -> paused.
theory: reveal -> mystery-revealed; make-joke -> inside-joke; quote -> quote.
quote: kind-clue (correct) -> spark; loud-clue or clever-clue -> theory, no penalty.
The earlier authored line is exactly “The quiet clue is usually the kind one.” It is introduced during this conversation, not invented childhood/origin memory. Both actual dialogue clues must be collected before any final outcome. begin on the same paused case resumes its previous node. begin after a completed outcome returns that one outcome; no branch farming.

Eligibility requires actual home.systems.dates.active matching dateId, phase arrived/date, no travel/local movement, two actual stationary colocated participants with canonical dateAssignments, actual consent IDs, adults/unrelated via existing romanceAvailability, an existing canonical pair tie, and exact normalized globalPlace.name or actual venue.name “Yark Green Thai Restaurant”. No address/restaurant entity or transport is created here. Root owns the verified preset and actual date start. Fictional case choices are presentational and may be made while paused; they never advance clock, grant food, spend money or change relationship status.

Outcomes:
mystery-revealed: original fictional envelope is a welcoming invitation; no crime/staff/real secret is claimed. Creates bounded canonical pair and date-memory moments.
inside-joke: our fictional detective brings an umbrella to an indoor mystery. recordDateMoment(type:experience) reuses existing discoverInsideJoke and canonical date-couple joke storage (“Our excellent weather forecast”). outcome.jokeId references that actual canonical joke. recall-joke on a later actual arrived date of the same eligible pair reuses applyDateMemoryCommand and records a canonical relationship recall. No reward; once per actual date. It works at other date venues too, because a shared joke can recur.
spark: correct literal quote after both clues and the quote node grants the explicitly authorized +30 romance capped100, and +30 reciprocal directed attraction capped100. Trust/resentment/status are preserved. Canonical tie.yarkGreenMysterySpark stores scenario/date/minute once PER COUPLE; repeated story dates, receipt eviction or reload cannot farm it. If already awarded, outcome reports zero new romance and no new heartBurst.

outcome includes {id,text,minute,romanceDelta,canonicalMemoryId,jokeId?,heartBurst?}. inspector heartBurst is null or {id,minute,personIds,requestedRomanceDelta:30,appliedRomanceDelta}; UI should emit hearts once per burst id, without looping on live updates. staging is {personIds,seated:true} only while this actual date and correct venue remain eligible; it is presentation-only, not a transport or invented object reservation.

Canonical relationship memories use bounded tie.memories entries with event/dateId/text/source; date scrapbook uses recordDateMoment. Scripted fiction is explicitly identified as authored gameplay. Mystery state holds one current case, eight completed date histories,48 receipts,24 completion events, capped32KiB. Persistent couple Spark marker prevents repeat reward even when module history is evicted. Quiet cancellation grants no outcome and may resume.

Root coordinates overlapping context: while active mystery dialogue is presented, suppress the separate generic date-cinema overlay; no scene file is changed by this module. Studio owns the nonmodal story UI, seated framing and heart particles.

Validation: eight unit tests cover eligibility, original quote/fiction notice, all three endings, capped reciprocal attraction/romance with unchanged status, recurring canonical joke, wrong-answer no penalty, serialization midtree, stable receipts, quiet resume, bounded retention and anti-farming across dates.

## Procedural mode and API integration

The authored case remains compatible, with all original node/choice IDs retained. Every authored node now exposes six choices: original branches plus meaningful ask/reflect/pause options. These added reflective choices do not silently advance clues or award outcomes.

`enable-dynamic {dateId,commandId}` explicitly marks any actually eligible arrived consenting date with date.mysteryEnabled=true. It does not require Yark Green; ordinary unmarked dates remain outside the authored preset. Inspector canEnableDynamic indicates general eligibility, while eligible indicates the current marked/scenario context. This command resumes a paused dynamic case, or migrates the existing authored case—including clues, introduced line and prior canonical outcome—into an ongoing case. Existing outcome/relationship memories are preserved. There is no turn cap, duration limit or forced date completion.

Dynamic inspector active fields:
mode:'dynamic', turn, nodeId, needsGeneration, paused, currentFrame, frames, clueLedger, threads, quotes, summary, lastSelection, lastOutcome, milestones, usedRequestIds, priorAuthoredOutcome. Inspector title/text/choices project the current committed frame. While generation is needed or the case is paused, choices are empty to prevent double submission. Existing actual-date staging/eligibility checks continue to apply.

`ingest-frame {dateId,expectedNodeId,expectedTurn,requestId,frame,commandId}` accepts a response only while needsGeneration and not paused. expectedNodeId and expectedTurn are the CURRENT committed values before ingest. API request parentNodeId must equal active.nodeId and API request turn must equal active.turn; response identities must be echoed/checked by Root. Ingest increments turn by one, derives nodeId=`dynamic:<nextTurn>:<requestId prefix>` (the full ID is capped at96 characters, while the full requestId is retained), records requestId and stores a detached validated frame. Duplicate exact command receipts are idempotent; stale node/turn or reused request IDs reject. The same frame arriving again cannot overwrite later play. Ingestion never changes scores, money, needs, relationship status, quest completion or clock.

Shared strict schema/validator comes from world/date/mystery-contract.js, owned by the API agent:
{title,text,choices:[{id,label,intent}],clues:[{id,text}],threads:[{id,text,status}],summary,introducedQuote:null|{id,text},recallQuote:null|{quoteId,correctChoiceId}}.
Choices number 5–8; the API should normally produce 6. Intents: investigate,ask,reflect,joke,flirt,resolve,continue,pause. No model-provided numeric score/state operations are accepted. Bounds: title120,text2400,choice label180,clue/thread text240,summary2400,quote text180; IDs use the shared safe ASCII contract. Backend calls validateDateMysteryFrame with authoritative priorQuotes=active.quotes, existingClues=active.clueLedger, existingThreads=active.threads. The shared validator rejects contradictions, rewrites and invented recall keys.

Root API context can use summary, lastSelection, recentFrames=active.frames.slice(-4), priorQuotes=active.quotes, existingClues=active.clueLedger and existingThreads=active.threads. This backend never calls an LLM or pretends a deterministic fallback is generated. needsGeneration remains pending until an actual validated API response is ingested; provider errors belong in the UI and must not fabricate a successful frame.

A dynamic `choose` uses the same dateId/nodeId/choiceId/commandId signature. It records the actual displayed label and logical intent in continuity and canonical pair/date history. It then sets needsGeneration:true. Resolve is a selected narrative intent, not an invented automatic real quest completion. Flirt alone grants no score. Pause sets paused:true/needsGeneration:false and leaves the actual date running; explicit enable-dynamic resumes generation. Thus even a fictional resolution, joke or Spark can be followed by another scene instead of terminating the date.

Quote safety: introducedQuote.text MUST appear verbatim in the committed frame text. Quotes are stored as {id,text,introducedTurn,sourceNodeId}. A recall frame may reference only an authoritative quote from an EARLIER committed frame (introducedTurn<current turn); the shared validator requires the nominated choice label to equal that quote text exactly. A new quote introduced in the same frame cannot justify its own recall. Only selecting that exact prior-quote answer can request the existing one-per-couple capped Spark reward; model self-asserted correctness or score fields cannot. The canonical couple marker used by the authored case is reused, preventing cross-mode/date reward farming.

Joke-intent selections enter actual canonical choice memory. When the chosen text qualifies for existing discoverInsideJoke themes, recordDateMoment reuses canonical couple joke storage; otherwise it remains an honest selected humorous response without a fabricated joke award. Mystery joke recall recognizes these retained procedural joke sources too.

Dynamic retention: a full current frame, compact latest 8–12 frame chronology, clue ledger<=32, threads<=16, quote ledger<=8, summary<=2400, recent request IDs<=24, milestones<=8 and bounded receipts/history. Historical frame text is compacted and old receipt/history rows are evicted first under pressure; old noncurrent clues may be evicted to protect the 64KiB cap. Active case continuity and exact current choices remain intact. Authored-only state retains its 32KiB cap. Canonical pair Spark markers and actual relationship/date memories do not depend on receipt retention.

Validation now covers140 procedural turns and 45 maximum-size frames, retaining at least eight recent frames under64KiB; serialized state resumes the exact pending node and choices. It also covers arbitrary eligible venues, explicit marking, stale generation guards, no score from ingestion, pause/resume without ending a date, all authored-ending migrations, earlier-frame quote proof and no same-frame/model-asserted Spark.
