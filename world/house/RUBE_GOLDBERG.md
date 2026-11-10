# Household Rube Goldberg machine

The house toolbar's **Rube Goldberg machine** button starts one cooperative
activity at an installed dining table. It selects the free residents age six or
older who can fit around that table. Busy, away, exhausted or hungry residents
are left alone. School, sleep, meals and upcoming work still constrain free time.

The build costs $20 in household materials once and requires 45 actual shared
model minutes: sketch the chain, assemble it, then test it. The camera frames
the room and helpers gather at actual table chairs. The finished tabletop toy
has a ramp, marble, six dominoes, a seesaw and a bell. After construction the
button becomes **Run machine together**, a free 15-minute shared test.

Interrupted shared progress is retained; remaining work uses full five-minute
activity slots of at least fifteen minutes. A sole remaining helper cannot
finish a shared build. Successful runs and contributor minutes are saved in
`home.systems['rube-goldberg']`; completion also adds city events and journal
moments where journals are enabled. Complete household checkpoints restore
construction, memories and subsequent test runs without paying again.

The Three.js chain is a presentation of committed build/test progress, not a
separate physics engine. Its progress does not advance from wall time, so paused
or restored scenes cannot silently finish a test. Props attach to the installed
dining table; moving the table moves the toy, and a replacement table can host
an existing saved machine on its next run.

Tests: `test/house-rube-goldberg.test.js`,
`test/house-rube-goldberg-scene.test.js`, and
`test/e2e/house-rube-goldberg.e2e.js`.
