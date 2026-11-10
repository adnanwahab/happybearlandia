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

## Household projects and portable belongings

The toolbar retains its original tools. **Focus view** optionally groups them under
**Build**, **Household**, and **Stories**, keeps playback visible, and reduces the
resident dock to compact portraits and actions. **Show all tools** restores the
original controls; the preference survives a page reload. **Show resident details**
expands the dock in focus view. The existing **More** menu retains longer simulation
controls. **Household projects** opens projects, belongings, front-door exchanges,
outfits, the pancake window and food help. Clicking the garden entrance opens
front-door interactions.

`home-projects.js` registers the optional `home-projects` extension through the
normal worker command, checkpoint and replay path. Its first complete project,
**The Great Sofa Delivery**, has acquisition, clearing, paired carrying, repair,
decoration, real refreshments, a shared game and an appreciation conversation.
Existing furniture can be restored; purchased materials debit the canonical
household savings. An admitted neighbor can donate an actual available sofa:
that object leaves their original inventory and retains its identity. New project
placements search inside the synthetic room envelope and reject overlaps. If no
space exists the player must rearrange furniture in Build. Carrying includes a
quarter-turn coordination puzzle; it is a visual abstraction, not a physics or
surveyed-door clearance simulation.

Reading, garden, bedroom, music and play corners reuse the same attended project
stages. Supplies remain with a paused project, interrupted work grants no stage
completion, and finished furniture belongs to the ordinary house inventory.
Free-time autonomy can use the most recently finished corner. Children age four
and older can decorate; carrying needs two helpers age twelve or older, including
an adult. Project repair and carrying grant ordinary handiness/fitness practice;
shared appreciation uses the canonical conversation mechanism.

Portable plates, trays, cups, gifts, books, speakers, tools, toys and cushions have
stable identities, holders and rooms. Pickup, carrying/placement, handover, use,
search and return require actual attended activities. A dish can reserve a real
prepared portion, be carried or handed over, and feed its holder once. Interrupted
loading returns its reserved portion. Tool loans transfer an existing kit from
the lender's inventory and return that same identity. Initial small props are
explicitly sourced from existing furnishings; further purchases spend savings.
These are deliberately small props, not an unrestricted inventory or rigid-body
interaction system.

The pancake window is a two-hour, four-customer starter enterprise. Cooking uses
the existing stove and finite prepared portions. Service requires an actual
admitted neighboring customer and server. The customer's household payment and
one portion are reserved at admission; completion credits the hosting household
and feeds the customer. Cancellation refunds the reservation. Session receipts
are retained; there is no separate business wallet or duplicated wage stream.
The staffed mode described below adds recipe quality, customer complaints and
manual role assignments. Additional enterprise types and automatic staffing
schedules remain future work.

Completed advanced paintings, music and programming projects retain their creator
and source action. Paintings appear in the scene; other residents can request an
activity using the creation through its original device. Experienced cooking and
gardening also retain a personal accomplishment. Gardening here records an
accomplishment, not an invented harvest or food balance. Persistent wardrobes
store everyday, work, sleep, celebration and hobby colors, an accessory and a
personal room. Names use the existing canonical profile editor. Cloth materials
are unique per resident, so changing one outfit cannot recolor a housemate.

Food help lists actual prepared servings, available cooks, away caregivers and
known-neighbor invitations. Returning a caregiver explicitly ends their date.
Food delivery is unavailable until a real provider is connected. Evening home
counts use the same active-date visibility rule as the roster. Conversation
restrictions show player-facing wording instead of internal person-ID fields.
The loose fitting is the new project mishap; other breakage and outage behavior
continues to use existing household-life systems.

Verification: `home-projects.test.js` exercises complete and interrupted work,
purchases/retries, donation identity, portable food, handover, wardrobes, creation
use and customer payment/refund conservation. `house-home-projects.e2e.js` runs a
full project through the real worker and checks rendered clothing/props and
checkpoint restoration. Screen recovery and page-lifecycle checks remain covered
by their existing browser tests.

## Household noticeboard: a shared movie-night plan

**Noticeboard** in the house toolbar (or the clickable board in the living room)
opens a pinned household plan. Choose an adult organizer, a room and a time within
the next seven days. The default is two hours from now; tomorrow evening and
starting as soon as preparations finish are also available. Viewers are actual
residents or admitted guests, with a limit of four.

Preparation has three required jobs: prepare/pack snacks, arrange existing seating,
and choose a film on an installed TV. Making a sign is optional and available to
children age four and older. Cooking/packing requires age twelve; seating and film
choice require age six. A helper may do several jobs in sequence. Packed snacks
are removed from the ordinary prepared-food balance, retained with the plan and
consumed once by completed viewing. Cancelling packing or viewing preserves the
reserved food and grants no false completion or memory.

Jobs can be assigned explicitly. With **Let residents volunteer** and household
autonomy enabled, available residents volunteer according to their recorded skills,
traits and favorite activity. Existing actions, queues, walks, dates, urgent needs,
work, school and sleep take priority. Children can help during free time at home;
shared viewing uses the normal TV capacity, electricity and child screen allowance.
The film starts automatically when a volunteering plan is due and fully ready;
otherwise **Start movie night** is an explicit player action.

Known neighbors can be invited through the board. They walk to the door, must be
admitted through existing visitor controls and can then be added to the viewers.
A garden plan needs a TV and seating in the garden. Actual rain blocks outdoor
viewing. Moving the plan indoors retains packed food and reopens the seating,
film and sign preparations for the new room. Postponing retains completed work.
No television, guest, food or weather event is invented by the plan.

A completed forty-five-minute shared film creates a bounded noticeboard memory
with actual participant and source-action IDs. The open house attempts to attach
a small snapshot of the scene afterward; **Save a photo for this memory** remains
available if the renderer or worker was busy. The photo is a scene captured after
the occasion, rather than a reconstruction of a past frame. Up to eight memories
and thirty-two command receipts are retained. Plans, assignments, food reservations,
photos and memories use the existing worker checkpoint/replay path.

Implementation: `noticeboard.js`, `noticeboard-catalog.js`, `noticeboard-ui.js` and
`scene/noticeboard.js`. Tests: `test/house-noticeboard.test.js` and
`test/e2e/house-noticeboard.e2e.js`.

## Pet adventures: The Missing Slipper

**Pet adventures** is available in the toolbar and in the menu opened by clicking
an actual pet. Start **The Missing Slipper**, choose a resident who lives here,
then search the existing furniture named by the clues. Searches take fifteen
attended minutes; a wrong search adds a clue and an interrupted search grants no
find. Finding the slipper and returning it are separate activities. Returning it
unlocks recurring gentle fetch with that same persistent slipper, rather than
creating a new toy for every round. This first adventure introduces one explicitly
identified personal belonging per pet/owner pair, with a household limit of eight.

Existing petting, treats, play and brushing now build pet/person bonds from actual
completed activity time. Favorite people are derived from that recorded history.
A resident can introduce an existing sofa, rug, bed or chair as a familiar spot;
the pet notices when it moves, rotates or disappears. Showing a new spot requires
another actual activity. No resident population, money or furniture is invented.

**Enable daily pet adventures** is optional and requires household autonomy for
spontaneous behavior. On the modeled clock, a pet can begin another slipper
adventure after its twenty-four-hour cooldown, or offer the unlocked game to an
available resident who needs company. Player activities, queues, dates, urgent
needs, work and child routines take priority. Pausing autonomy stops spontaneous
adventures; manual searches and play remain available.

A familiar pet in the viewing room can curl up with a resident during a real
movie. The lap pose is rendered from the active movie's participant/action IDs,
and a lap memory requires completed viewing. An interrupted film creates no lap
memory. Pet interactions are exclusive while an adventure activity or lap visit
is underway, so the same pet cannot be booked twice.

Completed slipper stories and lap moments appear in **Pet stories and photos**
and on the **Noticeboard**. The open house attempts to save a small scene photo;
a manual photo button remains available if the renderer or worker was busy.
Photos represent the scene captured after the occasion, not a reconstructed past
frame. Pet identities, bonds, familiar spots, the slipper, unfinished searches,
fetch unlocks, event history and up to eight illustrated memories survive normal
worker checkpoint/reload. Neighboring pets do not yet have their own visit/travel
workflow; this update does not create fictional visiting pet identities.

Implementation: `pet-adventures.js`, `pet-adventures-ui.js` and
`scene/pet-adventures.js`, integrated with existing pet interactions, the pet
renderer, calendar availability and noticeboard. Verification lives in
`test/house-pet-adventures.test.js` and `test/e2e/house-pet-adventures.e2e.js`.

## Staffed pancake window and recoverable hosting mishaps

**Household projects → Pancake window** now supports a staffed session. An old
open session can adopt the additional controls while preserving its original
food and money balances. Sessions still last two modeled hours, serve at most
four customers and settle through the original `housePancakeService` escrow.

Assign an actual cook, server, seating host and cleanup helper. One person can
fill several roles in a small home; different residents can prepare the kitchen
and seating concurrently. Preparing seats and welcoming customers are actual
activities. Used places accumulate after service and must be cleared before the
third waiting place. Children age six or older can help seat or tidy during free
time, while school, care, meals, sleep and existing player requests retain priority.

Simple pancakes take 30 minutes. Berry pancakes require cooking level two, take
45 minutes and add eight in batch ingredient costs. Signature pancakes require
level three, take 60 minutes and add twelve. These costs are added to the normal
cook activity's actual per-serving ingredient charge. Completed cooking creates
finite portions, an observed batch quality and an identified cook; interrupted
cooking creates none. Other meals and food reservations consume the same canonical
prepared-food stock, so a batch cannot remain as fictional inventory after the
household eats it. A signature batch leaves a named household specialty.

Customer feedback reflects the actual batch, price, time waiting after placing
an order, and used places. An unhappy customer can receive a real replacement
portion, an attended apology, or one refund from the host's existing savings.
Cancellation returns the original service escrow once. A refunded sale reduces
net session sales and can still be settled after closing. Returning customers are
recorded by actual person ID; becoming a regular needs at least two distinct
completed sessions and a satisfactory average rating. Regulars can be invited
back by name through the existing actual-visitor routing and admission flow.
Closed sessions leave a
bounded history of sales, refunds, feedback and completed source actions.

An occasional loose-seat fitting interrupts service. The existing table is
identified rather than inventing a new chair. An eligible helper can use owned or
borrowed tools, use handiness level two, or spend 25 on a replacement fitting.
Alternatively, prepare an informal picnic around an actual household rug. The
original loose seat remains visibly marked while the floor gathering can continue.
A garden picnic pauses service during actual rain; moving the rug indoors and
preparing the new seating area allows the same session to continue.
Kitchen signage, used plates and the warning marker reflect committed hosting
state. Clicking the sign opens the pancake controls.

Implementation: `pancake-hosting.js`, `pancake-hosting-catalog.js`,
`pancake-hosting-ui.js`, `scene/pancake-window.js` and `focus-view.js`. Tests:
`test/pancake-hosting.test.js` and `test/e2e/house-pancake-hosting.e2e.js`.

Rube Goldberg helper availability now includes admitted visitors age six or older.
The machine panel explains each resident's blocker, offers invitations and eligible
returns home, and distinguishes a one-place table from an occupied dining area.
An explicit build can replace safe autonomous leisure, while player requests,
queues, meals, rest, school, work, dates and urgent needs retain priority. A dated
resident remains unavailable even when the reserving household index is zero.
**Start when two helpers are ready** saves a waiting request across checkpoints;
it buys no materials until the actual shared activity can begin. The request can
be cancelled, and normal playback—not wall-clock waiting—advances it.
