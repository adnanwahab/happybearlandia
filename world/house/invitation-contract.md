# Immediate direct invitations (Models)

Direct `inviteGuest` now transports the same existing adult agent to the selected host's actual home anchor at the current paused minute, from any position/job/trip/active visit. No population/financial-household/home identity changes, elapsed time, needs or cash bonus. Direct result plannedTravelMinutes0/statusvisiting; candidate distanceM and walkingTravelMinutes remain observational. Explicit `waitForAdmission:true` (party/provider door flow) retains actual door approach and admission; direct calls arrive inside immediately.

Admission retains adult/different-physical-home/capacity/actual-host-anchor checks; removes actual-home/currentactivity/travel/care/range blockers. All preflight validation before interruption. Repeated same-home invitation already physically present is idempotent, samevisitID/no newevent/no timer reset. Transfer archives prior visit as transferred, no pretendreturnedhome. New explicit visits ignore careConstraint for forced early return; actual supervision still determines consequences at original household, never edits guardianship.

Interrupts paired/group action, reconciles active queued tasks without rewards/refunds, preserves pending own-home tasks; clears cancelled indoor routes/reservations/manualwalk. Existing transit cancels once (elapsed/untraveled accounting+event), never completed or refunded; direct relocation explicitly logged as player transport, not a walking trip.

Implementation and required validation COMPLETE: direct guests from work/distant coordinates/actual in-flight walks arrive now; supervision override retainsvisit ratherthanimmediatelyreturning. Trip-cancel count increments once; elapsed/untraveled amounts recorded without completed-trip increments or fare refunds. Paired actors/indoorreservations released; runningqueuedtaskcancelled, pendingown-hometasksretained. Priorother-homevisits archived transferred withno returnedMinute; currentparty departure tracked. Reinvitealreadyhere identicalstate.17tests177assertions pass across immediate/worker visits/guestidentity/roommates/economy/parties (`/private/tmp/hbl-immediate-invite-complete.log`). Fly path guard and persistence tests previously28pass; no deployment/provisioning performed.

Normal Send home/visit expiry still uses actual return travel. Reinviting a pending-return guest creates a renewed explicit visit rather than silently keeping its returnRequested flag. Door admission direct reinvite reuses the waiting visit ID. Old serialized walking/outbound visits remain readable; newly created explicit visits carry typed overrideSupervision/arrivalMode fields and validation.

Final combined current-source validation:262pass0fail2249assertions across54files, including core/visits/guestidentity/queue/roommate/economy/party/familybridge/socialdiscovery/autosession/mappedhome/Flypath (`/private/tmp/hbl-core-current-final.log`). Focused latest invitation+familybridge+SQLite+Fly46pass331assertions (`/private/tmp/hbl-invite-family-final-focused.log`).

## Opt-in synthetic RSVP — house-rsvp.v1 (SHE-554)

The normal house picker sends `rsvp:true, waitForAdmission:true` through the
existing visit command and replay timeline. Existing callers without `rsvp`
retain immediate transport. RSVP does not contact a real person or service.
Malformed IDs/anchors/capacity fail preflight; valid declines record
HOUSE_VISIT_DECLINED with seed, rules version, actual IDs and Population minute.
Both accepted and declined commands are retained by the worker timeline.

Synthetic assumptions: host must be at the actual home anchor. Either party's
current travel, work/school, active interior action/visit, supervision constraint,
energy below20 or food satisfaction below15 declines. Future schedules are not
reserved. Willingness is clamp(.5 + friendship/200 - tension/200, .1, .95),
compared with Population counter draw(seed,guestIndex,minute,690+hostIndex).
Missing ties use zero friendship/tension. These are authored assumptions, not
observed preferences. Repeated same-minute requests make the same draw.

Accepted guests use existing walking, waiting, admission, expiry and return
mechanisms, with no supervision override. Walking estimate is not a promised
arrival; `arrivedMinute` is committed by Population movement. No clone, permanent
home/financial identity change, new clock or random stream mutation. Replay
requires the same checkpoint, commands, rules and step partition. The picker is
native dialog/buttons/search with live feedback and no motion dependency.
