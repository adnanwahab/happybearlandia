# Immutable family milestones

House's **Family milestones** opens read-only history rooted at the original
immutable experiment, excluding mutable autosessions. `milestones.js` follows up
to eight explicit parents using the existing Population codec and continuation
contract. Missing, cyclic or incompatible parents stop traversal with a notice.

Allowlisted `event.v2` move, roommate, job, birth and adoption records and canonical
`social.ties[*].commitmentMilestones` supply entries. Household-scoped events must
match the selected household; person-only records require membership observed in
the source checkpoint. Past membership outside those records is not reconstructed.
Starting relationships, current employment and differences between saves supply no
milestones. Roommate acceptance is agreement to physical co-residence, not proof of
arrival or a financial household change. Categories are presentation labels only.

Ticks are Population ticks. Event ticks must match the recorded minute and pinned
runtime step. Commitment records store minutes; exact integral conversion through
that same clock is required. An event's dated source is not itself a snapshot.
Seek links exist only for an immutable checkpoint at the exact event tick; no
nearest-tick seek, recomputation, live rewind or backfill. Each entry exposes its
record, path and immutable API source. Duplicate event/action IDs are shown once
on the validated branch. Filters use exact ticks and category intersection.

Native dialog, labels, selects, number input, details and links support keyboard,
touch and graphics-free use. No animation or graphics dependency is introduced.
Simulation rules, random draws, model versions and clocks are unchanged.
