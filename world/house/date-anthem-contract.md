# Our Terrible Anthem

Register createDateAnthemSystem() from date-anthem-system.js, descriptor/persisted id date-anthem. Only this new module, tests and this contract are owned here; Root installs and connects it. It uses the existing actual date pair/assignments, committed model clock, canonical traits/interests/date preferences, existing social tie and canonical date scrapbook. No second people, timer, wallet or relationship-status authority.

Inspector {schemaVersion,minute,availability:{available,reason},active,callback,history,staging,source}. active contains id,dateId,personIds,nodeId,title,text,choices:[{id,label}],partnerReaction (string),reaction:{id,text,expression,cause},expression,preference,rhythm,quiet,learnedPreference,payoff. Reaction IDs change only on actual commands/inputs; repeated inspection does not manufacture reactions. All story furnishings/host are clearly fictional game staging, not claims about a real venue’s layout or staff. Current preferences derive canonical traits/interests and date preference rules, with no invented embarrassing childhood or past performance.

All commands include {system:'date-anthem',dateId,commandId}; commandId must be stable and bounded 160. Exact duplicates return saved receipts without effects; conflicting reuse rejects. Supported types:
begin
choose {nodeId,choiceId}
rhythm {nodeId:'rhythm',rhythmId,beatIndex,input,elapsedMs,offsetMs?}
finish-rhythm {nodeId:'rhythm',rhythmId,elapsedMs}
restart-rhythm {nodeId:'rhythm',rhythmId}
photo {photoId}

Stages/choice IDs:
arrival: quiet-corner / near-music.
comfortable, quiet route: choose-quiet / invent-title / try-duet.
comfortable, music route: sing-together / be-audience / switch-quiet.
lead: player-leads / partner-leads / trade-lines.
rhythm: input protocol below.
quiet-song: gentle-song / silly-song / private-dance.
quiet-sharing: finish-quiet, only after actual shared minute.
comic-surprise: hear-reaction.
reaction: embrace-joke / credit-partner / retreat-booth.
payoff: take-photo / another-song / finish-story.
photo: skip-photo, or photo command acknowledging an actual saved image.
complete: no further story choices. The ACTUAL DATE REMAINS ACTIVE; no duration, ending or return command is issued.

Each ordinary choice returns partnerReaction and next choices immediately; inspector includes the same durable response. Music branch provides sung duet or active audience support; quiet branch has its own private song/title/sway choices and actual shared-time requirement. The comic turn introduces The Romantic Kettle via an explicitly fictional host (or the pair’s imagined announcement on the quiet route). Success and mistakes both lead to the shared comic scene; no score threshold blocks a fun ending.

## Rhythm protocol

One game lasts 45 visible seconds, with 10 prompts. active.rhythm includes id,leader,playerRole,durationMs:45000,beatCount:10,targets:[{beatIndex,targetMs,ownerPersonId}],nextBeat,inputs,attendedMinutes,requiredMinutes:1,performanceScore,cooperation,mistakes,partnerNotes,startedMinute,completedMinute.
Targets are 2250+4500*beatIndex milliseconds. Input beatIndex must equal nextBeat (0–9); timing must increase; accepted window is target−1200 through target+1400. UI supplies actual visible performance-clock elapsedMs. Optional offsetMs must equal elapsedMs−targetMs within 2 ms. These are bounded game input timing receipts, not a claim of trusted physical/audio telemetry. Backend never uses a private wall clock or advances simulation time from a click.

Player-owned prompts: hit / rest. A hit within±250ms is accurate; rest is a miss. Partner-owned prompts: encourage / rest. Encourage is the player’s support, not an automatic sung hit; rest leaves the partner room. Partner actually contributes notes under declared deterministic trait/skill-derived game rules. A prior player miss can cause the partner to deliberately echo the unusual rhythm, changing the performance and immediate reaction. Audience route gives all sung notes to the partner while the player supplies cues/encouragement.

The UI must run a genuine 45-second visible interaction and pause that visible clock while hidden/closed. No auto-hits. An unanswered prompt may submit rest at target+900ms, which is an actual missed/rest input. A missed event-loop window can use restart-rhythm; it resets inputs, score and attendance with no awards and changes rhythm.id. Include rhythmId in every input/finish/restart so delayed commands from a discarded attempt reject.

At 45 seconds with all 10 prompts, Root calls the actual worker onAdvanceMinute/observe1 and WAITS for acknowledgement, then sends finish-rhythm with elapsedMs>=45000 (<=120000). The backend also requires both actual date participants attended one committed modeled minute. prepare/advance hooks verify availability at interval start/end and ignore duplicate committed end-minute hooks. Away/traveling/separated participants earn no attendance. Thus time/input reporting alone cannot complete a score or relationship reward. The quiet alternative likewise requires one actual shared minute before finish-quiet. Root can advance that minute explicitly after the private activity.

PerformanceScore is a game result, separate from relationship care. Credit, embracing humor and respecting a quiet preference can change canonical partner-directed trust once after an actually completed shared activity; accuracy alone does not award romance/trust. Another song may be played, but does not reset the already-applied relationship response. No money, food, forced affection or relationship status is created.

## Memories and continuation

Canonical date recordDateMoment stores preference disclosure, actual completed music game, response and final event. The Romantic Kettle is a canonical couple insideJokes entry (bounded existing format, sourceMomentId), not a second joke registry. Disclosed preference joins existing learned preferences and date experience discovery when present. Final payoff includes only actual madeMemory, learnedPreference, insideJoke, acknowledged photoId and a plausible nextPossibility.

photo command requires an existing canonical saved photo with matching actual date/pair/time; it never invents a screenshot or successful upload. Root captures/persists the image using the existing media path first, then passes photoId. Skipping is a complete legitimate ending.

Completion creates a canonical anthem-completed pair/date event and bounded couple.anthemEvents. Later callback {eventId,dateId,text,source,preference} is derived from that actual retained event, never by quoting a status/log sentence or merely finding the word Kettle. Current staging {personIds,area:'music-corner'|'quiet-booth'|'photo-spot',fictionalInterior:true} is presentation-only. Root coordinates this story against overlapping generic cinema/quests while it is focused.

Module state: one current story, eight compact completed histories, 48 command receipts, 32 events, validated at most 40 KiB. Canonical memories/jokes retain their existing separate bounds. Saved mid-duet inputs, leader and reactions resume exactly; receipts/highwaters prevent repeated effects. Inspection is read-only.

Validation: 12 meaningful tests cover actual eligibility, current-trait preference source, different choices/reactions/options, ten prompt timing and attendance gates, real partner contribution/mistake echoes, score versus relationship care, quiet alternative, restart/stale input protection, unavailable pair/no duplicated intervals, serialized mid-duet receipts, canonical payoff/future callback, genuine saved-photo acknowledgement and bounded many-date continuation.
