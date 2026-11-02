function asArray(value) { return Array.isArray(value) ? value : []; }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function room(id, type, title, description, data = {}, options = {}) {
  return {
    id,
    type,
    title,
    description,
    order: options.order ?? 0,
    optional: Boolean(options.optional),
    data,
  };
}

export function buildMuseumManifest(input = {}, options = {}) {
  const record = input.snapshot || input.record || input;
  const experiment = record.experiment || input.experiment || {};
  if (!experiment?.plan) throw new Error("Museum generation requires a civic experiment plan");
  const simulations = asArray(record.simulationBatch?.simulations);
  const scenarioComparison = record.scenarioComparison || null;
  const sensitivity = record.sensitivity || null;
  const comparison = record.improvementComparison || null;
  const worlds = asArray(record.worldBatch?.worlds);
  const roomList = [];

  roomList.push(room("journal-plan", "journal-plan", "What people proposed", "Original journals, synthesis, goals, and actions.", {
    source: clone(experiment.source || {}),
    plan: clone(experiment.plan),
  }, { order: 10 }));

  roomList.push(room("assumptions", "assumptions", "The assumptions", "Every modeled variable, provenance badge, range, and user override.", {
    variables: clone(experiment.worldModel?.variables || []),
    overrides: clone(record.overrides || {}),
    evidenceLayer: clone(experiment.evidenceLayer || null),
  }, { order: 20 }));

  roomList.push(room("causal-system", "causal-graph", "The causal system", "Explore modeled causal edges and feedback loops.", {
    edges: clone(experiment.worldModel?.causalEdges || []),
    feedbackLoops: clone(experiment.worldModel?.feedbackLoops || []),
    nodes: clone(experiment.worldModel?.causalGraph?.nodes || []),
  }, { order: 30 }));

  roomList.push(room("future-landscape", "future-landscape", `${worlds.length || simulations.length} possible futures`, "Outcome landscape grouped by scenario family.", {
    worlds: clone(worlds),
    simulations: clone(simulations),
    scenarioComparison: clone(scenarioComparison),
  }, { order: 40 }));

  const adverse = [...simulations].sort((a, b) => Number(a.score ?? 0) - Number(b.score ?? 0)).slice(0, Number(options.failurePortalCount || 6));
  roomList.push(room("failure-gallery", "reality-portals", "Where the plan breaks", "Enter adverse realities and replay their timelines.", {
    portals: adverse.map((simulation) => ({
      id: `portal_${simulation.worldId}`,
      worldId: simulation.worldId,
      scenarioFamily: simulation.world?.scenarioFamily || null,
      score: simulation.score,
      timeline: clone(simulation.timeline || []),
      events: clone(simulation.events || []),
      explanation: clone(simulation.explanation || null),
    })),
  }, { order: 50, optional: !adverse.length }));

  roomList.push(room("diagnostics", "diagnostics", "Why outcomes diverged", "Sensitivity, failure modes, and weakest scenario diagnosis.", {
    sensitivity: clone(sensitivity),
    scenarioComparison: clone(scenarioComparison),
  }, { order: 60, optional: !sensitivity && !scenarioComparison }));

  roomList.push(room("revision", "revision", "The revision", "Compare the original plan with tested improvements on the same worlds.", {
    improvements: clone(record.improvements || []),
    comparison: clone(comparison),
    lineage: clone(experiment.lineage || record.lineage || {}),
  }, { order: 70, optional: !comparison && !asArray(record.improvements).length }));

  return {
    schemaVersion: "pensieve-museum-manifest.v1",
    createdAt: new Date().toISOString(),
    source: {
      experimentId: experiment.id || null,
      recordId: record.id || input?.source?.recordId || null,
      planId: experiment.plan?.id || null,
    },
    title: options.title || experiment.plan?.title || "Civic experiment",
    subtitle: "journal → plan → assumptions → futures → critique → revision",
    rooms: roomList.filter((row) => options.includeEmptyRooms || !row.optional).sort((a, b) => a.order - b.order),
    navigation: {
      startRoomId: "journal-plan",
      suggestedPath: roomList.filter((row) => options.includeEmptyRooms || !row.optional).sort((a, b) => a.order - b.order).map((row) => row.id),
    },
  };
}

export function museumRoomById(manifest, roomId) {
  return asArray(manifest?.rooms).find((row) => row.id === roomId) || null;
}

export function summarizeMuseumManifest(manifest) {
  const rooms = asArray(manifest?.rooms);
  return {
    roomCount: rooms.length,
    portalCount: rooms.filter((row) => row.type === "reality-portals").reduce((sum, row) => sum + asArray(row.data?.portals).length, 0),
    roomTypes: rooms.map((row) => row.type),
  };
}
