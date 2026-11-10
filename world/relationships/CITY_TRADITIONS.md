# Neighborhood traditions

City characters now have a **Neighborhood traditions** section alongside their
goals, promises and relationships. It adds city gatherings to the existing
household family-traditions system; it does not replace that system.

Adults can start:

- Friday park picnic: every Friday at 20:00 on the population model's calendar.
- Coworker lunch club: weekdays at 12:00, at an actual supplied dining location.
  The two founders must share a recorded employer (or a legacy job building).
- Monthly park potluck: every 30 simulated days at 20:00, starting on the next
  available evening. This is a social park gathering, not a dish inventory or
  a household cooking action.

The first event must be at least an hour away. Hosts can pause/resume, other
characters can join/leave. A member may join two enabled city traditions and a
group has eight places, with up to 32 definitions per city. Children continue
using school, care and household gatherings. Missing a city gathering does not
reduce trust or imply a deliberate broken promise.

Groups travel through the existing simulation. Dates, household activities,
manual movement, work, supervision and explicit promises keep their priorities.
Lunch outings can use an existing meal break, not paid work time. Population
outings respect energy, meal affordability, weather and service availability;
legacy outings use actual activity availability, stock, costs and routes.

A gathering opens its travel window an hour before the listed time and ends an
hour afterward. Invitations do not count as attendance. A pair must be physically
near the venue, out of transit, and observed together for ten modeled minutes
at or after the agreed time. The population worker measures overlapping actual
meal/recreation intervals, so being employed at the venue or merely passing
through cannot earn attendance. Each pair receives at most one relationship change
per occurrence. Resolved events appear in the city event history/feed and in
individual journals; preset-city journals use the existing SQLite recorder.

Friends can invite one additional adult each occurrence. Occasionally a nearby
newcomer gets an invitation when no friend is available. Guests who attend twice
can become regular members. Three shared gatherings mark a beloved neighborhood
ritual; individual attendance also earns a regular-attendee label. Repeat pairs
recall their inside joke, while a tense relationship produces an awkward pause
instead. These memories are available to the existing callback conversations.

Definitions, schedules, invitations, pair timers, attendance, inside-joke counts,
and the last 24 occurrence summaries live in `model.social.cityTraditions` (or
legacy `world.social`). Participant indexes keep routine lookups sparse. Social
commands use the existing worker command timeline and complete save system,
including restoration mid-gathering. No wall-clock timers or position writes
create attendance, and no skipped simulation interval fabricates shared visits.

Tests: `test/city-traditions.test.js` and
`test/e2e/city-traditions.e2e.js`.
