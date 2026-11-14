Priority visiting-Sim discovery fix API

NEW relationships.js export recordHouseRelationshipEncounter(model,action,minute). Models hook: call immediately AFTER action.progress[i]+=dt in recordHouseInterval with committed minute Math.min(model.minute,start+dt). It no-ops for non conversation/hug/cuddle/groupConversation; records an existing canonical pair ONLY after BOTH exact participants have positive actual attended progress. Group3–4 records positive-progress pairs. No admission-time contact, no score/needs/cash/memory/completion rewards. Stores durable canonical social.ties[key].encounter={firstMinute,lastMinute,firstActionId,lastActionId,firstType,lastType,totalAttendedMinutes,lastActionAttendedMinutes} + knownSinceMinute,lastEncounterMinute; repeated same progress cannot double-count. Existing seeded numeric values preserved.

Both financial host and visiting guest see the same persisted pair via inspectHouseRelationships scanning canonical ties. Recent actual contact time is ranked BEFORE unexperienced seeded household scores, including while the hug/conversation is still active. Completed real social memories continue only at fullattendance. completeHouseConversation and completeHouseAffection retain completion fallback discovery even if an older save/worker had no mid-interval hook. Root profile/UI reads canonical inspection; no UI-only synthetic relationship rows.

Tests will cover before any elapsedtime, one actor only, both actors after1min, reciprocal guest lists with >12existing household/socialties, sameprogressidempotence, mid-action save/restore andcompletedhug singleactualmemory. Root Models owns corehookwrite; root auditsPersonalitymodalusinginspectedguest/person profile ratherthan financialHH-only roster.

Models hook LANDED: recordHouseInterval calls recordHouseRelationshipEncounter immediately after committed participant progress, using min(model.minute,max(start,action.start)+dt). Actual visitor hug/conversation tests confirm no contact at admission; both reciprocal lists after1 actual minute; no premature memory; exact mid-action restore and continuation; completed hug only1memory. Interrupted partially attended affection retains contact but no completed memory. Focused16tests135assertions pass (`/private/tmp/hbl-relationship-discovery-final.log`).

Final resumed Models acceptance: core activities/affection tests now explicitly assert partially attended contacts persist with0completedmemories (old no-tie expectations superseded by user request). Six focused suites30pass208assert. Broader full current core/house/population/save/commitment suite result in `/private/tmp/hbl-core-complete.log` after shared discovery hook and infant/furniture/history fixes. Root standalone year run was inspected through day241; no restart or interruption by Models.

SHE-550 presentation contract: `inspectHouseRelationships` adds the read-only
boolean `recordedTie`, true only when the canonical pair key exists in
`model.social.ties`. Inspection-generated household backstory is false. No save
schema or simulation rules change. The profile constellation projects only true
rows from the existing inspected subset (default limit 12). It uses only valid
past `lastEncounterMinute` and retained memory minutes for contact recency;
missing or future contact times remain unknown. It does not equate tie strength
with contact, infer edges between neighbors, or infer causal evidence. Displayed
minutes use the current Population minute, not wall time. Canonical IDs remain
unchanged. Only members and admitted visitor profiles in the current view are
navigable; other saved ties explicitly state that the profile is unavailable.
A static SVG and equivalent native-button list require no WebGPU. Narrow screens
and reduced motion show the list alone. No new model or ODD rule is introduced.
