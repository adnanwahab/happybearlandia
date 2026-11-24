# City Systems Map data generator

Regenerates `data/city-systems-map/` for the City Systems Map at `/tools/city-systems-map`.

```sh
python3 -m pip install -r scripts/city-systems-map/requirements.txt
python3 scripts/city-systems-map/build.py
```

`build.py` downloads three pinned sample files from vis.gl's `deck.gl-data` repository into
`.cache/city-systems-map/raw/` (ignored by Git), refuses any file whose SHA-256 differs from
`config.py`, runs the steps below and replaces every JSON file in `data/city-systems-map/`.
Use `--cache` and `--out` to write somewhere else.

| Step | Reads | Writes |
| --- | --- | --- |
| `geo.py` | source files | land mask, shoreline, street network traced from taxi paths, park outlines, labels |
| `buildings.py` | step 1 | synthetic buildings along traced streets; attributes for every building (seed `SEED_BUILDINGS`) |
| `systems.py` | steps 1–2 | every synthetic system layer, ground fields and vehicle schedules (seed `SEED_SYSTEMS`) |
| `export.py` | step 3 | one JSON array per system, one record per line, plus `meta.json` with version, seeds and checksums |

With the versions in `requirements.txt` (Python 3.13) two runs produce byte-identical files,
including with different `PYTHONHASHSEED` values. Bump `VERSION` in `config.py` when a change
alters the output. What is observed, derived and synthetic, the file contract and the page's
scenario rules are documented in [docs/city-systems-map.md](../../docs/city-systems-map.md).
