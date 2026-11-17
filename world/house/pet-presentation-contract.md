# Pet care presentation

`pet-presentation.js` projects the existing synthetic Population household pet
records without mutation. Identity uses the exact pet ID. Food, rest, play and
affection read finite hunger, energy, fun and social values respectively; missing
values produce no meter. These are model values on the existing 0–100 scale,
not observations of animal welfare. Default companions have no need values.

Active `pet-interaction` actions display a request; only lastPettedMinute and
interaction lastMinute records establish completed care. Completion text retains
the Population modeled minute. Economy activity supports eating, playing and
sleeping. A low value below 45 is a presentation cue only, not a new rule.

Scene labels and the personality panel share this projection. Sleeping uses a
static compressed pose. Tail motion occurs only for modeled play or an accepted
play/petting/brushing action and is suppressed by prefers-reduced-motion. No
pet timer, render loop, particle system or GPU resource is added. The surrounding
House renderer retains its existing frame scheduling; no whole-scene idle-power
measurement or guarantee is made. The personality panel remains available when
3D initialization fails. Existing care commands retain admission and completion
ownership, including cash, IDs, clock and event provenance.
