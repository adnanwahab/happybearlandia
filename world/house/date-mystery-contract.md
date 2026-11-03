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
