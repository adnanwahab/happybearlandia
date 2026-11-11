# Bakery evidence export

Open `/world/sprint2/bakery-export.html` for the comparison that keeps the road open at month 72. The Bakery journey’s **Export Bakery evidence** link carries the active intervention recipe when a comparison is open. The export page reports invalid or unsupported recipes before offering a download.

The `hbl-bakery-evidence/1` JSON file contains the baseline and intervention's complete monthly states and events, their versioned replay recipes and journey paths, and the open and closed road solver inputs, deliveries, traces, and input hashes. Recipe IDs identify deterministic reruns. Use the matching Bakery scenario and logistics solver versions to replay them. The page builds the download locally from the same scenario and fixture modules as the journey. There is no export API or server configuration.

JSON object keys use the repository's canonical ordering. Arrays preserve the source order. The export is UTF-8 with a trailing newline and contains no generation timestamp or host-specific URL. Equivalent recipes produce identical bytes. The exported model rules and limitations describe how to interpret solver results, scenario outcomes, and the recorded event text.

Verify with `bun test test/sprint2-bakery-export.test.js` and `bunx playwright test test/e2e/sprint2-bakery-export.e2e.js`.
