# Household scrapbook

House toolbar → Life scrapbook exports the current Population checkpoint and
validates it with `readPopulationCheckpoint`. `householdScrapbook` is a read-only
projection of its retained `event.v2` records. Household IDs and resident IDs are
scoped to that checkpoint prefix. Entries require matching model version and a
recorded, nonfuture tick and minute; no tick is calculated from a date/photo minute.
Chronology sorts by minute, tick, then event ID. IDs remain original event IDs.

Source disclosure opens the original event plus model version, seed and enclosing
checkpoint tick. This is event inspection, not restoration of an independently
recorded world state at that tick. Retention gaps are not reconstructed. Titles
format event type names; no generated biography or completion is added.

Photos require an explicit event `photoId`, a retained resident photo, and a local
acknowledged media URL. Date photos lacking that event link remain available in
the existing date memories UI; they cannot acquire inferred source ticks here.
Place IDs are shown only when explicitly present on the event. No new photo
capture, external provider, sharing, invitation, or media persistence is introduced.

Remembered content is hidden by default. A native checkbox hides every entry and
photo, including sensitive or speculative content, without classifying private
material heuristically. This preference is scoped to experiment and household in
localStorage. Storage failure uses hidden defaults and reports view-only changes.
This is a display preference, not deletion, access control, or redaction of saves;
the existing date scrapbook is a separate view. Native dialog, buttons and details
support keyboard and touch, with no animation/WebGL dependency.

No model rules, IDs, RNG, clocks, checkpoint retention, or simulation inputs change.
`docs/models/population.md` remains the authoritative ODD; this projection adds no
social model. Tests exercise chronology, source rejection and photo attribution.
The focused browser fixture exercises keyboard privacy/source/failure behavior;
normal-entry saved-house browser acceptance remains a release review requirement.
