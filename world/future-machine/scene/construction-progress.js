import {VERSION, housingProjectBuildingId} from '../../city/contracts.js';

/**
 * Project observations at one recorded monthly snapshot, not a forecast.
 * progress is the engine's accumulated work (duration is nominal work), not
 * percent of calendar time, completed homes, floors or a construction footprint.
 * housingProjectBuildingId is an identity rule, NOT evidence of a built asset;
 * buildingPresent separately checks this snapshot's actual inventory.
 */
export function recordedConstructionProgress(snapshot) {
  const state = snapshot?.state;
  if (!state || !Number.isInteger(state.month) || state.month < 0 ||
      !Array.isArray(state.projects) || !Array.isArray(state.buildings)) {
    throw new TypeError('Recorded City snapshot with month, projects and buildings required');
  }
  if (snapshot.month !== undefined && snapshot.month !== state.month) throw new TypeError('Snapshot month mismatch');
  const ids = new Set();
  return state.projects.map(project => {
    if (typeof project?.id !== 'string' || !project.id || ids.has(project.id)) throw new TypeError('Unique project identities required');
    ids.add(project.id);
    const progress = Number.isFinite(project.progress) ? project.progress : null;
    const duration = Number.isFinite(project.duration) && project.duration > 0 ? project.duration : null;
    const ratio = progress !== null && progress >= 0 && duration !== null && progress <= duration ? progress / duration : null;
    const buildingId = state.version === VERSION && project.type === 'housing' ? housingProjectBuildingId(project.id) : null;
    return {
      collection: 'projects', id: project.id, month: state.month,
      type: typeof project.type === 'string' ? project.type : null,
      stage: typeof project.stage === 'string' ? project.stage : null,
      progress, duration, progressRatio: ratio,
      units: Number.isFinite(project.units) && project.units >= 0 ? project.units : null,
      housingProjectBuildingId: buildingId,
      buildingPresent: buildingId === null ? null : state.buildings.some(building => building.id === buildingId),
      modelVersion: state.version ?? null,
    };
  }).sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
