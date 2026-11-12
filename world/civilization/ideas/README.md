# How Ideas Spread

Open `/world/civilization/ideas/` and choose a saved Living World. A direct link can pass `?experiment=<id>`. Running the experiment adds the idea, first adopter, random seed and rule version to the URL so the same save can replay the same result.

The read-only worker uses the existing World experiment GET endpoint and Population checkpoint codec. It projects successful talk commands from the saved `runtime.socialTimeline` and retained conversations from `model.hotspots.encounters`. Both use the checkpoint’s native Population identity and simulation minutes. Each modeled transmission records the input save, source collection, ordinal, people and place when available. Evidence links reopen the exact checkpoint. The Population contact collections lack individual replay URLs. Source saves are immutable and existing storage provenance applies.

The rules introduce the idea at the first retained contact involving the selected resident. Each eligible conversation has a seeded adoption draw and, for an original idea, a separate chance of adopting a remixed version. New holders can transmit starting the next minute. Holds fade after 24 model hours and a faded resident can adopt again. Results use at most 512 retained contacts, end at the checkpoint, and describe a hypothetical overlay on synthetic recorded interactions. Institution-level contacts, changing friendship ties, and empirical adoption calibration require further evidence.

Run `bun test test/idea-diffusion.test.js` for deterministic replay, remix, decay and an actual accepted Population talk round-trip through World storage.

## Local sharing v0 (SHE-254)

Run `bun run compare:local-ideas` for a complete JSON comparison, including the
versioned recipe, fixed positions, every transmission, and spread curves. The
headless entry uses `local.js`; it does not modify Population checkpoints or the
saved-contact UI above. One idea (`drainage-policy-changed`) starts at tick zero.
Residents have explicit synthetic positions in meters. Each round, informed
residents attempt adoption across peers within an inclusive fixed radius using
seeded draws. A new recipient can share only on the next round. First successful
source in canonical ID order wins competing exposures. Every hop retains source,
receiver, tick, distance, draw, hop count and parent event ID back to the origin.
No mutation, decay, movement or global broadcast occurs.

The paired control uses identical positions, origin, seed, horizon, radius and
adoption probability with sharing disabled. `validateLocalIdea` verifies the
entire retained report against a deterministic replay. Limits are 512 residents
and 1,000 rounds; the fixed peer graph uses quadratic construction. These are
engineering bounds, not a million-resident performance result. This standalone
model does not export Population or agent-count metrics, and its adoption events
must not be interpreted as independent resident updates or observed human facts.

Recorded synthetic example: seed 42, 25 residents on an 8-meter grid, radius
8 meters, adoption probability 0.65, 12 rounds. Sharing reaches all 25 residents
by round 9; control remains at one, a final difference of 24. Full paired curves,
inputs and 24 parent-linked hops are in
[`docs/evidence/local-ideas-v0.json`](../../../docs/evidence/local-ideas-v0.json).
This ablation demonstrates dependence on this model's local sharing rule; it
neither reproduces Axelrod's cultural model nor establishes polarization or
real-world information spread. Focused checks:
`bun test test/local-ideas.test.js test/idea-diffusion.test.js test/agent-counts.test.js`.
