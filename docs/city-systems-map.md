# City Systems Map

`/tools/city-systems-map` shows about 35 city systems on one 3D deck.gl map of Lower Manhattan and
the facing Brooklyn, Queens and New Jersey waterfronts. A 24-hour clock drives traffic, transit,
building lights and the sun, and four scenarios change what the systems show. It is registered as
the `city-systems-map` experience (evidence `mixed`), so it appears in the homepage gallery,
`/routes` and the command palette, and receives the shared HBL navigation.

| Part | Path |
| --- | --- |
| Page | `tools/city-systems-map.html`, `.css`, `.js` |
| Data (46 files, about 5.7 MB) | `data/city-systems-map/*.json`, served at `/data/city-systems-map/` |
| Generator | `scripts/city-systems-map/` |
| Tests | `test/city-systems-map.test.js`, `test/e2e/city-systems-map.e2e.js` |

The page is a visualization of a fixed synthetic dataset. It keeps no simulation state, shares no
run, entity or clock identity with World, City or Decision Studio, and writes nothing.

## Observed, derived and synthetic

| Kind | What |
| --- | --- |
| Observed | 999 building footprints with heights; taxi trip paths with timestamps (NYC TLC trip records, as sampled for deck.gl's trips example); resident dots for Manhattan (US Census sample, as prepared for deck.gl's scatterplot example); subway station names. All three files come from vis.gl's `deck.gl-data` repository (MIT), pinned by commit and SHA-256 in `scripts/city-systems-map/config.py`. |
| Derived | The street network (5,112 segments) is traced from the taxi paths, so streets no sampled cab used are missing. The land mask and shoreline come from where streets, residents and buildings are, plus hand-drawn New Jersey and Queens edges. Park outlines are approximate shapes at real park locations. Subway station positions are approximate. |
| Synthetic | The other 9,437 buildings and every building attribute (use, year built, energy use, rent, rooftop solar, power network). Every other layer: schedules, counts, capacities, readings, rents, crashes, 311 requests, sensors, proposals, and all vehicle and pedestrian movement except the taxi trips. |

Synthetic values are plausible magnitudes chosen for the demo, not calibrated estimates. They are
not evidence about Manhattan and should not inform decisions. The page footer and tooltips say the
same thing in place; `meta.json` lists the three categories and the source checksums.

## Time and scenario rules

These are display rules in `tools/city-systems-map.js`, not a model. Nothing accumulates between
frames except the clock.

- **Clock.** Tuesday, September 15, 2026 at 40.72° N. Sun height follows the NOAA solar-position
  approximation and sets ambient light, building colour and night window light. A demand
  curve with peaks near 8:36 AM and 5:48 PM scales traffic volume, walkers, KPI values and train
  headways (4 minutes at rush hour, 8 minutes midday, 16 minutes overnight). Vehicle schedules
  loop: taxi, van, truck, ambulance and pedestrian trips every 2,500 s; trains, buses and ferries
  every hour.
- **Typical day.** Air temperature 73.5 °F ± 7.5 °F, warmest at 3 PM; PM2.5 background 8 µg/m³.
- **Heat wave.** 90.5 °F ± 8.5 °F; PM2.5 background 15 µg/m³; cooling centers open 9 AM–9 PM;
  ER waits × 1.6; well-being lowered.
- **Coastal storm.** A storm-tide slider (0–14 ft). Flood depth is the tide minus synthetic ground
  elevation. From 8 ft every subway line on the map is suspended; from 9 ft substations 1 and 2
  go offline. Ferries stop, traffic falls by half and sewer outfalls overflow.
- **Grid failure.** From 2:10 PM substations 4 and 6 are offline. Buildings, EV chargers and cell
  sites without battery backup on those networks go dark, nearby streets slow, the J Z and
  B D F M lines are suspended and cooling centers open.

## Data contract

Every file is a JSON array with one record per line. Coordinates are `[longitude, latitude]`
(WGS 84). `meta.json` holds one record: data `version`, generator `seeds`, Python and package
versions, `sources` (URL, SHA-256, licence, upstream), the `observed`/`derived`/`synthetic` lists,
the map `bbox`, the vehicle loop length and the field grid size.

| File | Record |
| --- | --- |
| `buildings` | `[polygon (flat lng, lat…), height m, use 0 residential / 1 office and retail / 2 civic, year built, energy use kBtu/ft²·yr, floors, floor area m², median 1BR rent $/month (0 if not residential), rooftop solar kWh/yr, zone, substation index (−1 outside the grid), real footprint 0/1]` |
| `streets` | `[lng1, lat1, lng2, lat2, class 0–3, crosses water 0/1]` |
| `taxis`, `vans`, `trucks`, `ambulances`, `walkers`, `subway-trains`, `buses`, `ferries`, `wind` | `{p: flat path, t: seconds per point}` plus line or vendor fields |
| `fields` | `{name, data}`: base64 bytes, one per 20 m cell over `bbox`, row 0 at the north edge; value/255, except `elev`, which is metres/25 |
| `water-mains`, `steam-mains` | indexes into `streets` (water mains also carry psi) |
| `fire-response` | `[lng1, lat1, lng2, lat2, seconds from the nearest firehouse]` |
| Point layers | `pos` plus layer fields, or `[lng, lat, …]` rows for trees, storefronts, litter baskets, residents and 311 requests |

`test/city-systems-map.test.js` checks that the page's file list matches the directory, every
file parses, the 999 real footprints stay marked, trips have one timestamp per point in time
order, coordinates stay on the map, street references resolve, fields decode to the grid size, the
meta matches `config.py`, and the real server serves the page with the shared navigation.

## Reproduce the data

```sh
python3 -m pip install -r scripts/city-systems-map/requirements.txt   # numpy 2.5.3, scipy 1.18.1,
python3 scripts/city-systems-map/build.py                             # networkx 3.7, scikit-image 0.26.0
```

Seeds are 7 (buildings) and 42 (systems). With Python 3.13 and those versions, two builds are
byte-identical, including under different `PYTHONHASHSEED` values. Change `VERSION` in
`config.py` whenever the output changes.

## Checks

```sh
bun test test/city-systems-map.test.js
bunx playwright test test/e2e/city-systems-map.e2e.js
```

The browser journey loads deck.gl from jsDelivr. Where that is blocked, set `HBL_DECK_GL_BUNDLE`
to a local copy of `deck.gl@9.4.1/dist.min.js`; the page's SRI attribute still verifies it.

## Limitations

- deck.gl 9.4.1 loads from jsDelivr, pinned with SRI, as the Houston map does. Without it the page
  says the library could not be loaded.
- The server does not compress responses, so a first visit downloads about 5.7 MB of JSON.
- Streets are limited to taxi coverage; the shoreline and park outlines are approximate.
- The scenario rules are fixed thresholds and curves. A real flood, outage or heat model would
  replace them and needs its own model description.
