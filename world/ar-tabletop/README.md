# AR City Tabletop

Enter from the World sidebar or `/world/ar-tabletop/`. This isolated prototype
uses `tabletop-geometry/1`, immutable authored geometry with local fictional metre
coordinates and stable building IDs. It does not map the loaded World, produce
social-model results, or claim sourced geographic placement. Both views read the
same pinned geometry. No random generator, simulation clock or run is involved.

Start AR alone requests immersive-ar with mandatory hit-test. The browser must
support WebXR AR in a secure context. Three.js WebGL renders a 100 metre schematic
city at 0.002–0.01 physical metres per fictional metre. Horizontal hit poses ground
the city; select/Place locks it until Reposition. There is no automatic locomotion
or animation, and 2D remains the keyboard/reduced-motion alternative. Optional DOM
overlay supplies controls and provenance in supporting XR browsers; browser system
exit remains available without overlay. Device placement and overlay require real
hardware verification. No capture, upload, storage or sharing API is used.

Run `bun test test/ar-tabletop.test.js` and
`bunx playwright test --config test/ar-tabletop.browser.config.mjs`.
See `docs/reviews/SHE-779.md` for evidence and remaining acceptance.
