# Uncertainty Tide Lines data contract

Entry: `/world/worlds.html?simulation=…&seed=…&years=…&people=…`.
The chart reads the same browser-local Possible Worlds Lab batch used by the
worlds search. It does not launch additional simulations or combine independent
model authorities. Open the Lab link and finish or stop a run to save a batch.

Producer: `world/futures.js::runFuture`, `world/lab.html::save/storageKey`.
Consumer: `world/uncertainty-tides.js`. Registry: `world/paired.js::METRICS`.
Only `futures-1` is supported. Latest-pointer key is
`hbl:lab-latest:<snapshot>:<baseSeed>`; the referenced key must begin with
`hbl:lab:<snapshot>:<baseSeed>:<years>:<people>:`. Remaining key fields retain
the Lab's step, encoded assumptions and plan variants. These remain separate
batches; the reader never merges them. Snapshot revisions are not recorded by
this legacy producer: source revision equivalence is unavailable, and this is
not a new persistent/revision-isolated run contract.

Batch shape: `{version, cfg:{years,step,assumptions,labels,variants}, futures}`.
A future has `{index,seed,simYears,years:{[year]:{baseline,plans:[metrics]}}}`.
Missing status means a legacy completed record; explicit status must equal
`completed`. Seeds must equal `<baseSeed>:reality:<index>`. Duplicate indices
are ambiguous and excluded. Selection uses the first N seed slots (10/25/50/100),
not the first N successful runs. Missing slots are retained in the denominator;
this is not random subsampling or a population estimate. Plan means plans[0].

The expected checkpoint schedule is `simYears(cfg.years,cfg.step)`. At each
checkpoint, a pair contributes only if its year is recorded in simYears and
both arms have finite numeric values for the selected metric. Null, strings,
NaN and infinity are missing, never zero. No imputation or replacement occurs.
Percentiles use linear interpolation at `(n-1)*q` in sorted valid values,
q=0.1/0.5/0.9. Each arm uses exactly the same valid pairs for that metric/year.
Counts can change by metric or checkpoint. No pairs yields unavailable values.
A singleton yields three equal percentiles, not evidence of low uncertainty.

X units are modeled years since start; these checkpoints summarize a simulated
week at each year, not continuous monthly histories. Playback reveals one
recorded checkpoint every 800 ms; disconnected vertical P10–P90 intervals and
P50 dots invent no intervening months. Both arms and every checkpoint share a
y-domain for the current metric/sample selection. Changing the selection can
change that domain. The text table gives exact selected-checkpoint values and
valid/selected counts. Missing or incompatible batches show an unavailable
message, not an illustrative replacement.

All metric values are synthetic computed model outcomes. Source geography may
be observed upstream but is not plotted as an observation here. Assumptions and
variants remain in the original batch; the plot cannot validate their empirical
calibration. Percentile spread describes these seed slots under those assumptions,
not real-world odds, causal identification, confidence bounds or population
counts. There are no decorative data layers or new agent/social mechanisms.
No ODD rules change; existing `docs/models/README.md` inventory remains applicable.
Fixture `test/fixtures/uncertainty-tides/batch.js` is deterministic authored display
data, explicitly not an observed dataset or claimed simulation execution.

Playback owns one interval, cleared on pause, selection, scrub, document hiding
and disposal. Disposal removes the visibility listener, control handlers and
DOM. The worlds entry disposes on non-persisted pagehide; bfcache retention keeps
the chart and visibility changes pause it. No GPU/renderer allocations are added.
Consumer-device frame-time and disposal profiling remain required before claiming
hardware performance acceptance; browser/unit/build evidence is separate.
