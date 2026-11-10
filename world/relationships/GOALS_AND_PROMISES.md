# Personal goals and promises

Click a city character to see **Personal goals**, **Promises**, and their
relationship details. Goals include a new shared memory, repairing a rivalry,
and developing an existing crush. Adults can also make time for someone through
**Arrange park meetup**. Children retain their school/care routines and pursue
conversation goals; evening park promises require two adults.

Meetups use supplied park locations, at 20:00 on the next evening at least ninety
minutes away for which both characters have free schedules. One active promise
per person prevents double booking. Characters depart an hour before the meetup
using existing travel; work, care, manual commands, interior activities, blocked
routes and weather can prevent arrival. Neither creating nor resolving a promise
moves a character's position directly.

A promise is kept only after both people are actually near the park, not in
transit, together for ten modeled minutes at/after the agreed time. The window
closes forty-five minutes after the agreed time. Kept promises increase trust
and friendship; missed ones lower trust and add tension. Cancellation informs
both characters and cancels promise-owned legacy travel without replacing a
player's unrelated command. Goals stay completed after short-term memories age
out. Callback conversations can reference promise outcomes.

Goals, achievements, trust and promises are part of the existing social model
state. The worker social-command timeline replays arrangements/cancellations;
complete population and legacy checkpoints restore the in-progress state.
Creating, cancelling, keeping and missing a promise adds a memory to both
characters and a journal moment. In preset cities these journal moments use the
existing SQLite journal recorder. The SQLite archive does not itself restore a
world; the complete save system does that.

Active promises are indexed by participant, capped at 128 citywide. The city
retains up to 512 recent promises and twelve memories per relationship. Durable
goal achievements survive that trimming. These are illustrative game rules.

Validation: `test/personal-goals-promises.test.js` covers attendance, cancellation,
weather, goals, trust and both simulation adapters. Browser tests in
`test/e2e/personal-goals-promises.e2e.js` exercise the actual worker, controls,
checkpoint replay and city inspector.
