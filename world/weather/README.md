# Weather and gameplay

The Weather button on `/world` controls the active simulation's weather source. Automatic conditions use a seed and absolute modeled hour/day; manual temperature, rain and storm controls change inputs without advancing time or resetting residents.

Rain changes walking/cycling comfort costs and therefore transport choices. It does not accelerate pedestrians or guarantee every trip switches to transit. Heat reduces outdoor recreation/park preference and raises a concurrent electricity-load proxy. Storms reduce coarse road, transit and service availability. Existing route, budget and schedule constraints still apply. Electricity is reported in modeled kW against explicitly assumed capacity, not measured kWh or a physical power-grid simulation. Storms do not invent hydraulic damage.

The legacy world owns `world.weather`. The canonical WorldRuntime owns a weather subsystem and passes copied inputs to its population model. The Living City worker owns its weather and population together; `runtime.getWeatherSimulation()` is a read/configure facade, not another UI-side simulation. The renderer reads accepted snapshots.

Living weather changes are recorded as at most 128 explicit commands with committed model minutes. Commands are retained in future manifests, selected-person replays and future replays. Cancelled/busy wall time does not become simulation time. Replay uses the manifest's original model cadence; it is not a claim that different stepping cadences produce identical resident decisions.

Focused weather tests cover seeded conditions, restored continuation, manual validation, pause, real mode-choice changes, park decisions, electricity demand, service restrictions and same-seed worker replay. The browser check confirmed paused 42°C configuration raised modeled demand from 54 to 88.02 kW for its 100-person fixture without moving the clock, and reproduced exact future terminal metrics.
