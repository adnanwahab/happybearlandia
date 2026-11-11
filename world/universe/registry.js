// Integration catalog. Excludes the Tools directory app, Blog, and Twitch robot.
// Apps under /tools retain their standalone routes and are separate experiences.
export const EXPERIENCES = Object.freeze([
  {
    "category": "worlds",
    "title": "World",
    "description": "Explore the streamed city, its residents, policy tools and saved experiments.",
    "route": "/world",
    "preview": "/world?embed=1&demo=1&quality=LOW",
    "id": "world",
    "evidence": "synthetic",
    "role": "authoritative stage"
  },
  {
    "category": "worlds",
    "title": "Houston Map",
    "description": "Explore sourced Houston building footprints in a lightweight browser map.",
    "route": "/tools/houston-map",
    "preview": "/tools/houston-map",
    "id": "houston-map",
    "evidence": "mixed",
    "role": "map experience"
  },
  {
    "category": "worlds",
    "title": "Flower: Breeze & Petals 3D",
    "description": "Explore a 3D world of breeze and petals.",
    "route": "/tools/flower",
    "preview": "/tools/flower",
    "id": "flower",
    "evidence": "fictional",
    "role": "experience"
  },
  {
    "category": "living",
    "title": "1,000 Inner Lives",
    "route": "/tools/inner-lives",
    "preview": "/tools/inner-lives",
    "id": "inner-lives",
    "description": "Explore 1,000 Inner Lives.",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "games",
    "title": "AI Seinfeld 3D Simulator",
    "description": "Explore an interactive 3D sitcom simulator.",
    "route": "/tools/ai-seinfeld",
    "preview": "/tools/ai-seinfeld",
    "id": "ai-seinfeld",
    "evidence": "fictional",
    "role": "experience"
  },
  {
    "category": "science",
    "title": "Security Viz Lab",
    "description": "Explore six WebGPU security visualization prototypes.",
    "route": "/tools/security-viz-lab",
    "preview": "/tools/security-viz-lab",
    "id": "security-viz-lab",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "living",
    "title": "Worldline",
    "description": "Run possible futures and explore outcomes under different assumptions.",
    "route": "/tools/worldline",
    "preview": "/tools/worldline",
    "id": "worldline",
    "evidence": "synthetic",
    "role": "future navigation"
  },
  {
    "category": "living",
    "title": "Living City",
    "description": "Inspect people, households, work calendars, needs and simulated behavior.",
    "route": "/world?living=1",
    "preview": "/world?living=1",
    "id": "living-city",
    "evidence": "synthetic",
    "role": "population simulation"
  },
  {
    "category": "science",
    "title": "Particle simulations",
    "description": "Explore parallel particle motion and interactions.",
    "route": "/tools/webgpu/particle-simulations.html",
    "preview": "/tools/webgpu/particle-simulations.html",
    "id": "particles",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "games",
    "title": "Everybody Act Normal",
    "description": "A multiplayer house party: blend in, complete secret missions, and spot your friends.",
    "route": "/world/party/act-normal",
    "preview": "/world/party/act-normal",
    "id": "act-normal",
    "evidence": "fictional",
    "role": "experience"
  },
  {
    "category": "worlds",
    "title": "Constitution City",
    "description": "Compile clauses and compare synchronized baseline and amended worlds.",
    "route": "/visualize-constitution",
    "preview": "/visualize-constitution",
    "id": "constitution-city",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "games",
    "title": "Game",
    "description": "Enter the existing interactive physics playground.",
    "route": "/game",
    "preview": "/game",
    "id": "game",
    "evidence": "fictional",
    "role": "experience"
  },
  {
    "category": "worlds",
    "title": "3D Quote Carousel",
    "description": "Explore quotes in an interactive spiral and cylinder.",
    "route": "/tools/quote-carousel",
    "preview": "/tools/quote-carousel",
    "id": "quote-carousel",
    "evidence": "fictional",
    "role": "experience"
  },
  {
    "category": "living",
    "title": "FlowMap",
    "description": "Explore Gulf Coast supply-chain disruptions and rerouting.",
    "route": "/tools/flowmap",
    "preview": "/tools/flowmap",
    "id": "flowmap",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "living",
    "title": "House Simulator",
    "description": "Enter a saved city household, inspect its needs and change its home.",
    "route": "/world/house",
    "preview": "/world/house",
    "id": "house",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "living",
    "title": "AgentGraph",
    "description": "Observe and debug AI agent organizations.",
    "route": "/tools/agentgraph",
    "preview": "/tools/agentgraph",
    "id": "agentgraph",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "worlds",
    "title": "Lumen",
    "description": "Inspect 3D models with a zero-install GPU model viewer.",
    "route": "/tools/lumen/",
    "preview": "/tools/lumen/",
    "id": "lumen",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "science",
    "title": "Molecular docking",
    "description": "Score synthetic ligand poses against an illustrative receptor.",
    "route": "/tools/webgpu/molecular-docking.html",
    "preview": "/tools/webgpu/molecular-docking.html",
    "id": "molecular-docking",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "science",
    "title": "Astronomy / signal search",
    "description": "Find a synthetic periodic signal hidden in noise.",
    "route": "/tools/webgpu/astronomy-signal-search.html",
    "preview": "/tools/webgpu/astronomy-signal-search.html",
    "id": "astronomy",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "science",
    "title": "RiskUniverse \u00b7 100,000 financial futures",
    "description": "Reproducible WebGPU portfolio Monte Carlo with tail-risk attribution, sensitivity, and numerical reference checks.",
    "route": "/tools/riskuniverse/",
    "preview": "/tools/riskuniverse/",
    "id": "riskuniverse",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "science",
    "title": "Epidemic ensembles",
    "description": "Compare many independent outbreak simulations under different assumptions.",
    "route": "/tools/webgpu/epidemic-ensembles.html",
    "preview": "/tools/webgpu/epidemic-ensembles.html",
    "id": "epidemics",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "science",
    "title": "Evolutionary algorithms",
    "description": "Evaluate a population of candidate solutions and evolve toward better fitness.",
    "route": "/tools/webgpu/evolutionary-algorithms.html",
    "preview": "/tools/webgpu/evolutionary-algorithms.html",
    "id": "evolution",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "science",
    "title": "Climate ensembles",
    "description": "Compare independently parameterized energy-balance model futures.",
    "route": "/tools/webgpu/climate-ensembles.html",
    "preview": "/tools/webgpu/climate-ensembles.html",
    "id": "climate",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "science",
    "title": "Monte Carlo simulations",
    "description": "Independent seeded experiments estimate \u03c0 and reveal convergence.",
    "route": "/tools/webgpu/monte-carlo.html",
    "preview": "/tools/webgpu/monte-carlo.html",
    "id": "monte-carlo",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "tools",
    "title": "Experiments",
    "description": "Follow the idea \u2192 futures \u2192 human impact \u2192 fork \u2192 share workflow.",
    "route": "/reality-compiler",
    "preview": "/reality-compiler",
    "id": "experiments",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "tools",
    "title": "Dear Congress bridge",
    "description": "Load the source plan into HBL and inspect its supported city mechanisms.",
    "route": "/world/constitution-city.html",
    "preview": "/world/constitution-city.html",
    "id": "dear-congress",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "tools",
    "title": "World Line Talk",
    "route": "/tools/world-line-talk",
    "preview": "/tools/world-line-talk",
    "id": "world-line-talk",
    "description": "Explore World Line Talk.",
    "evidence": "fictional",
    "role": "experience"
  },
  {
    "category": "tools",
    "title": "Decision Studio",
    "description": "Frame a decision, compare alternatives and enter recorded construction futures.",
    "route": "/world/decision.html",
    "preview": "/world/decision.html",
    "id": "decision",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "tools",
    "title": "Business simulator",
    "description": "Launch a business and follow its actual operating ledger over time.",
    "route": "/business-simulator",
    "preview": "/business-simulator",
    "id": "business",
    "evidence": "synthetic",
    "role": "experience"
  },
  {
    "category": "games",
    "title": "Houston Bar Atlas",
    "description": "Browse OSM-tagged Houston-area bars, then play a clearly fictional interior scene anchored to sourced building geometry when available.",
    "route": "/world/bars/",
    "preview": "/world/bars/",
    "id": "houston-bars",
    "evidence": "mixed",
    "role": "playable venue atlas"
  },
  {
    "category": "tools",
    "title": "Optimization",
    "description": "Open Decision Studio\u2019s \u201cExplain, fork & optimize\u201d tools for bounded searches.",
    "route": "/world/decision.html#advanced",
    "preview": "/world/decision.html#advanced",
    "id": "optimization",
    "evidence": "synthetic",
    "role": "experience"
  }
].map(app => Object.freeze(app)));
export function getExperience(id) { return EXPERIENCES.find(app => app.id === id); }
export function searchExperiences(query = '') {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return EXPERIENCES.filter(app => terms.every(term => `${app.id} ${app.title} ${app.description} ${app.route} ${app.category}`.toLowerCase().includes(term)));
}
export function entityActions(context) {
  if (!context.entityId) return [];
  const ids = ['world', 'living-city', 'house', 'worldline', 'decision'];
  if (context.entityId.startsWith('person:')) ids.push('inner-lives','game','act-normal','world-line-talk');
  return ids.map(getExperience);
}
