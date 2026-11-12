# Scientific dataset export (SHE-193)

This read-only adapter exports a validated `canonical-run-receipt.v1` from
Future Machine. It exports the selected month's paired aggregate metrics, not
all 121 months or entities. It preserves the entire receipt with events,
decisions, rules, recipe, outcome digests and limitations in `provenance.json`.
These are synthetic model results, not measured city data or causal estimates.
Other model authorities and imported measured datasets require separate adapters.

```sh
bun scripts/export-run-receipt.js http://localhost:3000 city_EXPERIMENT 16 > receipt.json
python3 -m pip install -r scripts/scientific-export-requirements.txt
bun scripts/export-scientific-data.js receipt.json ./new-dataset
# Explicit mode when only JSON and CSV are needed (no Python dependency):
bun scripts/export-scientific-data.js receipt.json ./new-text-dataset json-csv
```

The destination must not exist. Input receipt/checksum, row types, finite values,
identity bounds and duplicates are checked before publication. Default mode
requires Parquet success and schema/row round-trip validation; failure removes
temporary files and publishes no dataset. No server or production writes occur.

Notebook usage, with no cleanup or JSON flattening:

```python
import pandas as pd
from pathlib import Path
import json
p = Path('new-dataset')
parquet = pd.read_parquet(p / 'metrics.parquet')
json_rows = pd.read_json(p / 'metrics.json')
csv_rows = pd.read_csv(p / 'metrics.csv')
manifest = json.loads((p / 'manifest.json').read_text())
```

`manifest.json` identifies the dataset by receipt SHA-256, inventories files with
raw-byte SHA-256 checksums, and links the JSON Schema, dictionary and provenance.
Rows carry dataset, scenario, model, seed and month identities. `value` is a
nullable float (empty CSV cell for unavailable), seeds are 64-bit Parquet
integers to preserve the full uint32 range. JSON/CSV retain the same column order
and values; missing documented units remain `unknown`, never guessed. The
source currently omits units for overloadedServices and utilityFailures.

Measured sources are explicitly empty for this generator. Synthetic inputs
include the versioned generator, full recipe and assumptions. The repository
has no declared dataset license: `NOASSERTION` records that absence and does not
grant redistribution rights. License assignment needs the rights holder.

FAIR layout: content-derived identifier and descriptive manifest (findable),
ordinary local files with declared access (accessible), Parquet/JSON/CSV and a
JSON Schema (interoperable), dictionary, source classification and full provenance
(reusable). This is a portable local layout, not a public registry or repository
with a DOI, hosting, access controls or an asserted open-data license.

Verification: `bun test test/scientific-export.test.js test/run-receipt.test.js`.
The Parquet integration test runs when Python has PyArrow and otherwise reports
a skip. JSON/CSV are independently read with Python's standard library.
