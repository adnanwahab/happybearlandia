/** POPULATION RUNTIME CONTRACT (browser, no DOM):
 * createPopulationRuntime({config,worldContext,workerCount=2,onUpdate,onError})
 * => {ready:Promise,getSnapshot(),subscribe(fn),pause(),resume(),step(),
 * setSpeed(n),updateConfig(config),inspectPerson(id),inspectHousehold(id),destroy()}.
 * updateConfig is an explicit RESET/RESEED, with reset provenance; it is never a
 * silent policy mutation. Simulation clock is fixed-step, independent of RAF.
 * Frames are typed transferable visible-agent snapshots, not whole populations.
 * Models adapter API must be agreed before execution; see population.worker.js.
 */
