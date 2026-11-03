# Resident plans and household comedy

Open a saved household and select **Resident plans** in the top actions. One
personal request appears as a thought card in the house. The modal provides
Current request, Favorites and habits, Performances and objects, and News and
scrapbook views. This builds on the existing Story Director, evening planner,
comedy, relationships, progression and canonical household activity engine.

## Playable situations

Dinner With Complications, introductions, apologies, first performances,
celebrations and returning borrowed objects use actual household residents.
Approaches include proper preparation, an honest simple meal, group company,
and rehearsal. Dinner runs through cooking, finite prepared portions, dining,
conversation and cleanup. Player choices do not complete an activity early.
An existing queued action, date, work commitment, care obligation or urgent
need can block admission; the UI shows the reason.

Karaoke complications require a real competing karaoke action by an available
third resident with music equipment. Missing-food complications require the
actual last portion to have been eaten before the planned meal. A stopped or
interrupted action supplies no completion evidence. Resolutions change the next
real activity: stop the competing performance, talk in the garden if available,
join a performance, apologize, prepare replacement food, or make a playful
investigation of the recorded incident. The garden response moves the subsequent
conversation, rather than pretending an already completed meal moved rooms.

The default cast comes from the current household. Known adult friends can be
selected and invited through the existing walk-to-door and admission system.
There are no cloned guests. Celebrations are explicitly planned occasions;
this system does not invent a birthday or change a resident's age.

## Discoveries and habits

Completed meals, jokes, activities, performances and gifts reveal favorites.
The discovered values have action IDs, times and context. Explicit canonical
social favorites take precedence; otherwise preferences are deterministic
fictional gameplay tastes. Hidden tastes are not exposed before discovery.
Meal themes are presentation choices on the existing finite meal engine, not
new nutrition or recipe inventories. Gifts and performance context use tastes
to select visual reactions without directly awarding relationship points.

Six tendencies vary real idle behavior: aspiring entertainer, anxious host,
enthusiastic helper, competitive roommate, sentimental collector and terrible
liar. They can rehearse, clean different spaces, propose real board games, read,
or return recorded loans. They use the existing autonomy switch and admission
checks and do not interrupt player queues. Existing relationship conversations
remain the authority for relationship score changes.

## Performances and social objects

Karaoke, comedy, dramatic readings, talent shows, celebration speeches, duets,
mock awards and household news use timed attended activities. Original lyrics
or material are limited to 280 plain-text characters. Delivery choices include
household stories, impressions, inviting a second performer, waiting for the
audience, acknowledging a bad joke and a kind finish. A duet needs two actual
performers. Karaoke needs installed music equipment. Audience reactions use
actual participants, fictional tastes, existing relationships and knowledge of
an actual callback memory. Unattending residents are not invented witnesses.

Procedural poses and short reactions include singing, rehearsing, watching,
playing, offering an object, proud posture, awkward glances, phone checking,
supportive responses, laughter, delayed laughter and a double take. They observe
committed model outcomes; they do not advance the simulation. Singing is a
visual performance with authored text, not synthesized vocals. Costumes are
temporary performance colors requiring an installed costume chest.

New purchasable inventory objects are an acoustic guitar, board-game table,
baking equipment, costume chest, camera and microphone. They have explicit
footprints, independent meshes and ordinary household purchase costs. Baking
still needs the existing stove and ingredient/serving mechanism. A portrait
records the actual posing cast; its initial scrapbook representation is a
stylized card. The player can attach a real current-scene snapshot afterward.
A reading corner continues to use real books and seating already in the house.

## Gifts loans and consequences

A completed gift transfers ownership of the same installed book, guitar, plant,
easel, camera or game; no item, cash or population is duplicated. Only an owner
can give away another personally owned item. Outstanding loans must be returned
first. Borrowing records the existing object, its owner and borrower. Returning
it needs an actual timed activity; an apology can follow through the existing
conversation system. These are household object loans, not a full clothing or
portable-inventory simulation.

Selected shared moments become scrapbook cards with actual source action IDs.
A memory can prompt a later autonomous conversation between its participants,
subject to the same availability checks. Callbacks are limited to two per card.
Repeated performances or games can become opt-in weekly traditions after two
completed occasions. Player catchphrases appear during sourced performance
reactions. Optional surreal imagination scenes are explicitly labeled fiction.

News contains three recent recorded developments with source actions, a camera
follow-up and a link back to the unfinished plan. Scrapbook captions are
explicitly player-authored. JPEG snapshots are bounded to 24 KiB, with at most
four images retained. Text memories remain capped at sixteen.

## State and verification

Registry ID: `situations`; optional state: `home.systems.situations`;
schema: `house-situations.v1`. Commands use the existing worker-owned household
system dispatcher, stable receipts and checkpoints. The existing household
ledger owns food, cash, activity attendance, needs and skills. New state retains
only situation progress, learned context, loans and memory provenance.

Limits: one active plan, four participants per performance or game, 64 event
rows, 16 memories, eight traditions, 16 loan records and 24 command receipts.
Command receipts are additionally trimmed to keep the state under its byte
budget. Older detailed events can be evicted; retained cards keep their source
IDs. No LLM service is required for the simulation.

Focused model tests: `situation-system.test.js`. Browser workflow:
`test/e2e/house-resident-plans.e2e.js`. Existing evening, comedy, story director,
object, focus, UI and lifecycle suites cover adjoining systems.

## Screen stability

`page-lifecycle.js` pauses and saves on every page hide without erasing the UI.
Returning pages refresh and preserve their prior play/pause state. Resource
teardown is reserved for explicit disposal, since an initially non-cached hide
can still be followed by a retained-page return.

`screen-guard.js` and `bootstrap.js` provide an independent recovery shell for
module startup failures or an emptied application root. The renderer shows
visible graphics-loss/error controls and pauses repeated failed drawing rather
than silently clearing the household. Context restoration redraws the existing
scene without replacing its authoritative model. Initial renderer failures are
also visible. Browser checks cover both page-hide variants, viewport changes,
context loss/restoration, empty-root recovery and failed module loading. These
checks address specific reproduced paths; they are not a guarantee against
browser or GPU process crashes.
