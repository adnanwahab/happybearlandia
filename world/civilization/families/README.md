# Generational Families

Open `/world/civilization/families/?experiment=<saved-id>` from a saved Living World. The optional `person` query parameter accepts the exact Population resident ID. The form also accepts both IDs.

This read-only view uses the immutable World experiment API and the existing Population checkpoint codec. The family tree reads `people.parent1` and `people.parent2`. When present, the durable `populationLineage` entry supplies the actual modeled birth or adoption record and minute. Generated starting relationships have no dated event. Names, homes, and work use the selected checkpoint's original resident and location IDs.

The view follows up to eight explicit saved parents and stops at unreadable or incompatible checkpoints. It checks the Population model's continuation contract and monotonic clock before carrying IDs across saves. Homes and employment are checkpoint observations, and changes only establish an interval. World replay links open the corresponding saved checkpoint. Monthly CityState IDs and ongoing House autosave sessions do not enter this history.

Run `bun test test/generational-families.test.js`.
