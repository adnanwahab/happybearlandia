export const COMPARISON_METADATA_VERSION = 'decision-comparison-view.v1';
/** Native view state only. No inferred pairs, geography, time conversions or results. */
export function snapshotComparisonMetadata(state) {
  const {selectedRunId,baselineRunId,axes,projection,rotation,metricKey,scenarioFilter,unfavorable,outcomeFilter,colorMode,searchQuery,gridSize,page,showGhost,showDensity,lassoMode,lassoIds,replayIndex} = state;
  if (![selectedRunId,baselineRunId].every(id=>id===null||typeof id==='string')) throw new TypeError('Native selected run required.');
  if (!axes || !['x','y','z'].every(k=>typeof axes[k]==='string') || !['2d','3d'].includes(projection) || !Number.isFinite(rotation)) throw new TypeError('Native axes/projection/rotation required.');
  if (![metricKey,scenarioFilter,outcomeFilter,colorMode,searchQuery].every(v=>typeof v==='string')) throw new TypeError('Native filter metadata required.');
  if (![unfavorable,showGhost,showDensity,lassoMode].every(v=>typeof v==='boolean') || ![100,500].includes(gridSize) || ![page,replayIndex].every(v=>Number.isInteger(v)&&v>=0)) throw new TypeError('Native comparison controls required.');
  if (!Array.isArray(lassoIds) || !lassoIds.every(v=>typeof v==='string')) throw new TypeError('Native lasso run IDs required.');
  return Object.freeze({schemaVersion:COMPARISON_METADATA_VERSION,selectedRunId,baselineRunId,
    axes:Object.freeze({x:axes.x,y:axes.y,z:axes.z}),projection,rotation,metricKey,scenarioFilter,unfavorable,outcomeFilter,colorMode,searchQuery,gridSize,page,showGhost,showDensity,lassoMode,
    lassoIds:Object.freeze([...new Set(lassoIds)].sort()),replayIndex});
}
