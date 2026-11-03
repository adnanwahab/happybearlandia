# Household comedy

`createComedySystem()` in `comedy-system.js` returns system `comedy`. The installer owns registration. `comedy-content.js` is the original dialogue and static action catalog; it imports no runtime modules.

## Commands and actual action ownership

```js
runtime.householdSystemCommand({
  householdId,
  system: 'comedy',
  type: 'perform',
  episodeId: 'fridge-strike',
  choiceId: 'promote-fridge',
  personId,
  commandId,
  // objectId is optional; otherwise choose an eligible installed object deterministically.
});
```

Episode order: `fridge-strike` (player title **The Kitchen Is on Strike**, existing `stove` or future `fridge`) → `sofa-election` (`couch`) → `porcelain-tribunal` (`toilet`). Each episode completes once, with three alternative choices. An actual installed garden plant is required for `nominate-plant`; the other election choices work without one.

The command calls `context.actionAvailability` and `context.startAction`. `comedyPerformance` reserves one actual available adult and the actual object through the existing dispatcher for fifteen simulation minutes. It never interrupts another activity, bypasses queues, advances time, or changes the household wallet. The dispatcher persists its validated choice under `action.systemData.comedy`; the admission hook stores the pending action and replay receipt. Spatial admission runs before comedy: `requestedMinute` retains the command time, and `startedMinute` is the actual post-routing attendance start, which may be in the future while walking. Travel grants no scene attendance. The completion hook requires that same live action and its actual full attendance. Clicking, incomplete attendance, interrupted actions, and fabricated hook progress cannot unlock episodes.

Eating the representative, government offices, strikes, and elections are comic staging. They do not consume/create meals, prevent normal kitchen/bathroom use, change relationships, or grant cash or instant needs. The scene uses declared ordinary need decay. Rewards are cosmetic souvenirs, authored story memories, and achievements derived from completed records.

## Read-only inspection and presentation

`inspectHouse(...).systems.comedy` exposes:

- `title`, `description`, `minute`, and three `episodes`: `{id,title,description,objectTypes,durationMinutes,available,lockedReason,completed,outcome,choices}`. Choices have `{id,label,hint,available,reason}`.
- `actors`: actual physical household residents with `{personId,name,ageYears,atHome,available,reason}`. Availability remains advisory; the authoritative dispatcher rechecks actual object/room capacity, conditions, and actor availability on submission.
- `active`: `{actionId,episodeId,choiceId,personId,objectId,objectType,roomId,title,quote,speaker,startedMinute,durationMinutes,elapsedMinutes,remainingMinutes,progress,status,...}`. Progress is committed attendance, with no wall-clock extrapolation.
- `events`: `{id,type,minute,episodeId,choiceId,actionId,personId,objectId,objectType,roomId,text,quote,speaker,witness,effect}`. Types are `comedy-started`, `comedy-completed`, `comedy-interrupted`, `comedy-callback`. Witnesses are optional `{personId,name,quote,style,basis}` from actual present adult residents. Reactions are scripted game dialogue, not an acoustic simulation or a new social graph.
- `memories`, `achievements`, `mayor`, and `completed`. These are projections of the three durable completed records.
- `souvenirs`: `{id,kind,objectId,objectType,personId,title,episodeId,choiceId}`. Kinds are `union-sticker`, `certificate`, `fridge-tie`, `mayor-sash`, `toilet-minister`. A promotion tie can be on the existing stove. A plant mayor sash targets the actual nominated plant. Deleted anchors are omitted; their earned memory remains.

Ambient callbacks require another completed real activity at the remembered object or in its room by the original actor or a recorded witness. They have a sixty-minute simulation cooldown, deterministic rotation, and no timers, external randomness, or repeated-inspection effects.

## Persistence and verification

Optional authoritative state lives only in `home.systems.comedy`, version `house-comedy.v1`: one pending scene, three durable outcomes, up to forty-eight command receipts, and thirty-two events. A byte cap of 64 KiB trims old receipts/events; combined system limits still belong to the framework. Recent command IDs replay without another action and reject payload changes; completed episode receipts remain recoverable from durable outcomes after receipt trimming, and completed episodes never grant duplicate rewards. An interrupted attempt can be retried with a fresh command ID. Restoring a legacy save without comedy state leaves it absent.

Validation rejects unknown choices, non-plain or unbounded data, future timestamps, invalid actual identities, duplicate/out-of-order outcomes, and pending state inconsistent with canonical action evidence. Missing pending actions are reconciled as interruptions on the next prepare/advance hook.

`comedy-system.test.js` exercises real system dispatch and population advancement, all nine choices, checkpoint continuity, replay, atomic rejection, interruption, missing plant/object gates, ordinary needs access, callback cooldowns, and bounded state.
