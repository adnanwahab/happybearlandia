# Neighborhood comparison

`compareNeighborhood` produces a deterministic `neighborhood-what-if.v1` paired
Population receipt. Both arms share seed, generated people, and starting homes;
one supported project is applied after generation. The receipt retains model
version, project inputs, seed, population, duration, assumption and resident
observations. It is separate from monthly City canonical run receipts.

`neighborhoodImpact(receipt, metric)` projects that receipt without rerunning it.
Supported metrics are commute (minutes), burden and access (percentage point
changes; before/after displayed as percentages). Group identity is the baseline
resident district ID, never the plan residence. Older receipts lacking IDs use
their recorded district label, which cannot disambiguate duplicate labels.
Means use only residents with matching IDs and finite observations in both arms.
Rows expose included, total and excluded counts. Districts with no valid pairs
are returned separately with a reason, and unmapped residents are counted.
Resident IDs fix summation order; rows sort by descending absolute mean delta,
then district ID using code-point ordering. Exact zero rows remain present.
Recorded resident `delta` fields are not trusted over the underlying observations.

The What if panel updates the summary when a measure is selected. Each metric is
ranked independently; there is no composite welfare score. Results are synthetic
one-day model differences, not causal evidence about real neighborhoods. Commute
is conditional on observed work departures in both arms and is resident-weighted,
not trip-weighted. Burden is resident-weighted here, unlike the household headline.
Moves stay attributed to the starting cohort. No uncertainty distribution is
estimated by one matched seed. Missing observations never become zero.

Verification: `bun test test/neighborhood-impact.test.js test/neighborhood-what-if.test.js`.
The focused browser journey is `test/e2e/neighborhood-what-if.e2e.js`.
