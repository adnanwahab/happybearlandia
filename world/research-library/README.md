# Research Library v1

Open `/world/research-library.html` from the workspace directory or Decision
Studio. The bundled housing catalog inventories current schema parameters,
registered equations and output definitions. It documents **synthetic assumptions**;
local code references do not establish empirical support. Other simulation
engines remain explicitly outside this inventory.

`library.js` is the DOM/network-free consumer contract. `createResearchLibrary`
and `readResearchLibrary` validate versioned snapshots; `evidenceGraph` projects
source-to-rule edges and missing evidence; `filterRules` selects assumptions,
sourced records or gaps. `libraryFromExperiment` projects civic experiments.
`attachEvidenceLayer` publishes that same snapshot at
`experiment.evidenceLayer.researchLibrary`, preserving existing model values and
legacy provenance. Calibration, validation and scientific exporters can read
this contract; their future workflows are not implemented here.

Sources require stable id, title, kind (`paper`, `model`, `dataset`,
`observation`), URL, license, actual retrieval date (`YYYY-MM-DD`) and nonempty
`supported rule IDs` in `supports`. Rules require id, label, kind (`parameter`,
`rule`, `metric`), explicit boolean `assumption`, and a rationale when true.
Duplicate IDs, invalid dates, unsupported versions and incomplete source records
are rejected. Dangling support links remain visible gaps instead of disappearing.
A source supports one or more rule IDs; the graph computes the reverse links.

The local model source retrieval date records repository inspection. License
`NOASSERTION` explicitly means permission is unresolved and appears in the gap
list; it is not a license grant. No external sources were downloaded. Source
kinds other than `model` are declared support, **not independently verified**
evidence. A rule may remain an assumption even when sources are linked. Legacy
civic records lacking license/retrieval date/URL are not silently upgraded.

JSON import opens a validated library for the current session (2 MB maximum);
export saves the exact versioned snapshot. Invalid imports preserve the previous
library. There is no shared mutable server store, browser autosave, paper search,
license verification or automatic model fitting. Use the exported JSON as the
versioned read artifact. Actual run seed/inputs remain in the experiment contract,
not inferred from library metadata.

Checks: `bun test test/research-library.test.js test/evidence-registry.test.js
 test/civic-experiment.test.js test/housing-model.test.js`.
