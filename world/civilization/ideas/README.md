# How Ideas Spread

Open `/world/civilization/ideas/` and choose a saved Living World. A direct link can pass `?experiment=<id>`. Running the experiment adds the idea, first adopter, random seed and rule version to the URL so the same save can replay the same result.

The read-only worker uses the existing World experiment GET endpoint and Population checkpoint codec. It projects successful talk commands from the saved `runtime.socialTimeline` and retained conversations from `model.hotspots.encounters`. Both use the checkpoint’s native Population identity and simulation minutes. Each modeled transmission records the input save, source collection, ordinal, people and place when available. Evidence links reopen the exact checkpoint. The Population contact collections lack individual replay URLs. Source saves are immutable and existing storage provenance applies.

The rules introduce the idea at the first retained contact involving the selected resident. Each eligible conversation has a seeded adoption draw and, for an original idea, a separate chance of adopting a remixed version. New holders can transmit starting the next minute. Holds fade after 24 model hours and a faded resident can adopt again. Results use at most 512 retained contacts, end at the checkpoint, and describe a hypothetical overlay on synthetic recorded interactions. Institution-level contacts, changing friendship ties, and empirical adoption calibration require further evidence.

Run `bun test test/idea-diffusion.test.js` for deterministic replay, remix, decay and an actual accepted Population talk round-trip through World storage.
