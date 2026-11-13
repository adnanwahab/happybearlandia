"""Encode and independently read back the typed scientific metric table."""
import json
import sys
import pyarrow as pa
import pyarrow.parquet as pq

with open(sys.argv[1], encoding='utf-8') as source:
    rows = json.load(source)
schema = pa.schema([
    pa.field('dataset_id', pa.string(), False),
    pa.field('model_version', pa.string(), False),
    pa.field('seed', pa.int64(), False),
    pa.field('scenario', pa.string(), False),
    pa.field('month', pa.int64(), False),
    pa.field('metric', pa.string(), False),
    pa.field('value', pa.float64(), True),
    pa.field('unit', pa.string(), False),
    pa.field('evidence_kind', pa.string(), False),
])
table = pa.Table.from_pylist(rows, schema=schema)
table.validate(full=True)
pq.write_table(table, sys.argv[2], compression='NONE')
restored = pq.read_table(sys.argv[2])
restored.validate(full=True)
if restored.schema != schema or restored.to_pylist() != rows:
    raise ValueError('Parquet round-trip mismatch')
