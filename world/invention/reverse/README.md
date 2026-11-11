# Reverse Simulator

Open `/world/invention/reverse/` from Invention Studio. Set a percentage reduction in mean modeled commute time, a maximum proposed policy cost, and the intervention types to include. The optional settings select the seed, horizon, and search limit.

The search constructs compatible bundles of up to four options from the shared City plan catalog. It screens proposed costs before simulation and tests the least expensive bundles first, up to the chosen 128 or 1,024 alternatives, or the full compatible catalog. It reports the actual number tested, the number over budget, and the number of affordable combinations outside the search limit. A cancellable browser worker runs the same monthly City model against one matched no-change baseline. Each evaluation compares final-month mean experienced commute minutes across recorded modeled trips. Trip counts, unemployment, and housing help explain changes in who commutes.

The frontier minimizes proposed cost, commute time, and unhoused households among plans reaching the target. When none meet it, the view says so and shows measured budget-eligible trade-offs including the baseline where applicable. Missing commute measures stay unavailable. Policy budgets are declared proposal inputs. Replay shows whether policies became active.

Each result opens the exact versioned plan at its evaluated month, passes the same recipe to Merge Studio, and can seed Reality Breakpoints. These are read-only synthetic scenario calculations using one seed. Results characterize the tested space and catalog, and have no persisted run ID.

Verify with `bun test test/reverse-simulator.test.js`.
