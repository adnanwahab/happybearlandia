/** Strict candidate hook patch: browser responses only; never edits shared source. */
export function candidateHooks(source,kind) {
  function replaceOnce(needle,replacement) {
    if (source.split(needle).length!==2) throw new Error(`Shared ${kind} changed: review transition hook ${needle.slice(0,70)}`);
    source=source.replace(needle,replacement);
  }
  if(kind==='visualizations') {
    source="import {snapshotComparisonMetadata} from './backlog-transitions/metadata.js';\n"+source;
    replaceOnce('    destroy(){if(destroyed)return;',`    getTransitionMetadata(){return snapshotComparisonMetadata({selectedRunId:selected?.id??null,baselineRunId:baselineSeeds.get(selected?.seed)?.id??null,axes:{x:xKey,y:yKey,z:zKey},projection:threeD?'3d':'2d',rotation:Number(control('rotation').value),metricKey,scenarioFilter,unfavorable,outcomeFilter,colorMode,searchQuery,gridSize,page,showGhost,showDensity,lassoMode,lassoIds:[...lassoIds],replayIndex})},
    destroy(){if(destroyed)return;`);
  } else {
    source="import {attachFutureTransitions} from './backlog-transitions/index.js';\n"+source;
    replaceOnce("async function enterFuture(run, {month = constructionMonth} = {}) {",`const futureTransitions=attachFutureTransitions({multiverse:$('#futures'),city:$('#physical-world'),getSelection(){const run=state.selectedRun||constructionRun;return {experimentId:state.results?.experiment?.id,runId:run?.id,scenarioId:run?.scenarioId,modelVersion:run?.modelVersion,seed:run?.seed,month:constructionMonth,comparison:visuals.getTransitionMetadata()}}});
addEventListener('pagehide',()=>futureTransitions.detach(),{once:true});
async function enterFuture(run, {month = constructionMonth} = {}) {
  futureTransitions.cancel('selection-loading');`);
    replaceOnce("  $('#physical-world').scrollIntoView({behavior:'smooth',block:'start'}); updateAdvancedStudio();",`  updateAdvancedStudio(); void futureTransitions.flyTo('city',{source:[...document.querySelectorAll('#futures [data-run-id]')].find(node=>node.dataset.runId===run.id)});`);
    replaceOnce("$('#futures').scrollIntoView({behavior:'smooth',block:'start'});", "void futureTransitions.flyTo('multiverse');");
    replaceOnce('window.hblDecisionStudio = { state,', 'window.hblDecisionStudio = { futureTransitions, state,');
  }
  return source;
}
