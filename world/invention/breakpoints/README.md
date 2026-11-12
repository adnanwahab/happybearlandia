# Reality Breakpoints

Open `/world/invention/breakpoints/` and set a metric, comparison and threshold. Configure the existing seeded Riverside City plan and run it. The initial snapshot is simulation month 2. A 12-step horizon tests months 3–14. Rerunning starts from the same initial snapshot with the edited plan and threshold.

The shared plan runner checks one completed City step at a time and exits after the first match. Equality depends on the selected comparison. Unemployment thresholds are entered in percentage points and compared against the underlying unrounded model rate. Missing observations do not match, and the report counts them separately. Month-zero starts are outside this scenario.

The pause report shows the preceding snapshot, original same-month system events and retained reasons, and the stages of any selected policies. Simultaneous events provide context. The source model does not assign an explanation to an aggregate threshold match. The scenario-viewer link regenerates the same versioned plan at the selected month. Breakpoints do not write a persisted checkpoint or modify the source scenario.
