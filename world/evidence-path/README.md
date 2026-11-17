# In-world evidence paths (v1)

Open **Evidence paths** on `/world`. Supply an existing run ID and target event
ID to read `/api/causality/explain`, or explicitly choose **Try synthetic path**.
The ordered itinerary and attached inspector remain available without animation.
Skip path, closing the panel, replacement and pagehide remove ground geometry.
The view never mutates or advances a run. It adds no social/agent mechanism.

`projectEvidencePath(data, mapping, frameId)` consumes the existing explain
response (`runId,targetId,nodes,edges,evidence,incomplete,reasons`). All records
retain exact IDs, ticks, scope and provenance. Only event-to-event recorded
causes/contributes/constrains edges with resolved same-scope citations qualify.
No correlations or inferred links bridge missing records. Only the component
attached to the target is shown, in source-tick/edge-ID order, at most 32 edges;
input collections and citation lists are bounded at 2048. Server incompleteness
and preview limits are disclosed. No absence-of-effect claims follow from gaps.

An explicit host adapter may provide a detached location mapping:

```js
{version:1, frameId:'adapter-owned-scene-revision', context:runContext,
 anchors:[{eventId:'event:authority:id',x:12,z:24,
           provenance:{kind:'observed',source:'versioned coordinate source'}}]}
```

The host passes the same **current scene revision** as `frameId`; it must change
when origin, geography, run mapping or scene transforms change (remount on scene
replacement). x/z are finite scene-local metres within ±100km; y=.3m is decorative
ground lift. Run/world/scenario/universe/modelVersion/seed must match exactly.
Duplicate anchors invalidate the mapping. Missing/invalid anchors, foreign scope
or a different frame yield labeled jumps, with no connecting ground geometry.
No coordinates are inferred from IDs, district membership or similarly named
entities. Spatial provenance describes location only; it does not strengthen the
edge's causal evidence. Endpoint/edge records and citations retain source IDs.

**Current integration boundary:** `/world` supplies no live mapping/frame because
monthly City records do not have a verified mapping into this rendered scene.
Stored chains therefore show jumps and their inspector. A producer-backed scene
adapter is still required for real stored-event geographic acceptance. The
synthetic fixture explicitly supplies its own stage frame and authored coordinates;
it is unrelated to underlying city buildings or street geometry. It has seed 744,
model/rules version evidence-fixture.v1, no random draws, no observed sources and
no computed model outcomes. All fixture events/relations/anchors are assumptions.

Ground rings and dashed direct connectors are decorative, static, depth-tested
Three.js geometry, never routing or streets. Choosing View ground segment moves
the camera immediately at the user's request; no animation or automatic walk.
Screen-reader itinerary labels each edge, endpoints, ticks, relationship, citations
and jumps. The inspector includes nonspatial records verbatim and provenance kinds:
observed sources, assumed inputs, simulated effects, derived calculations. A
stored model mechanism is not empirical causal evidence. Unknown provenance stays
unavailable. No probability or population estimate is introduced.

Every replacement removes the old group and disposes all geometries/materials.
No textures, per-frame work, timers (except bounded fetch deadline), or animation
loops are added. `getStats()` reports live objects and cumulative disposal calls,
not GPU memory. Consumer-device frame time and actual GPU resource reclamation
require hardware measurement; unit disposal spies cannot establish those results.
