export const layers = ['observed sources', 'synthetic assumptions', 'computed model effects', 'unsupported behaviors'];
const text = value => typeof value === 'string' && value.trim().length > 0;
/** Exact identity/revision matching only. Metadata never supplies a numeric outcome. */
export function inspectCoverage(metadata, scope, entityId, layer) {
  const missing = {state:'unknown', reason:'No matching versioned availability record.', needed:'Provide an authority-scoped model/input record, source citation, revision and entity mapping.', evidence:'None'};
  if (!metadata || metadata.schemaVersion !== 'hbl-availability.v1' || !text(scope) || !layers.includes(layer) || !text(entityId) || metadata.scope !== scope || !text(metadata.revision) || !Array.isArray(metadata.cells)) return missing;
  const rows = metadata.cells.filter(row => row?.entityId === entityId && row?.layer === layer);
  if (rows.length !== 1) return missing;
  const row = rows[0];
  if (!['available','missing','unsupported'].includes(row.state) || ![row.reason,row.needed,row.evidence].every(text)) return missing;
  return {...row, revision:metadata.revision};
}

export function mountUnknowns({container,getData}) {
  const doc=container.ownerDocument,root=doc.createElement('details');
  root.dataset.unknowns='';
  root.innerHTML='<summary>Map of Unknowns</summary><p>Explore gaps in model coverage. Terrain is decorative: tile size and height encode no quantity. ? unknown · / missing · × unsupported · ✓ record available (not validation).</p><button type="button">Refresh coverage</button><label>Evidence layer <select></select></label><p data-scope></p><div data-terrain></div><output role="status" aria-live="polite">Choose a tile to inspect its missing model or input.</output>';
  const style=doc.createElement('style');style.textContent='[data-unknowns]{max-width:min(360px,85vw);color:#eef4ff}[data-unknowns] select,[data-unknowns] button{min-height:44px;max-width:100%}[data-unknowns] [data-terrain]{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;max-height:230px;overflow:auto;padding:6px}[data-unknowns] [data-terrain] button{background:repeating-linear-gradient(135deg,#24354a,#24354a 7px,#3f536a 7px,#3f536a 9px);color:white;border:1px solid #93aecb;overflow-wrap:anywhere;box-shadow:0 3px #0b1728}[data-unknowns] :focus-visible{outline:3px solid #ffe39b}[data-unknowns] output{display:block;white-space:pre-line;overflow-wrap:anywhere;max-height:220px;overflow:auto}';
  root.append(style);container.append(root);
  const select=root.querySelector('select'),terrain=root.querySelector('[data-terrain]'),output=root.querySelector('output'),refresh=root.querySelector('button');
  for(const layer of layers){const option=doc.createElement('option');option.value=layer;option.textContent=layer;select.append(option);}
  let disposed=false;
  function render(){
    if(disposed)return;
    terrain.replaceChildren();output.textContent='Choose a tile. Missing coverage is never zero.';
    try{
      const data=getData();
      root.querySelector('[data-scope]').textContent=`Scope: ${data.scope || 'unknown'} · original loaded buildings only; no district or cross-model mapping. First 60 entities shown. Refresh after changing view.`;
      for(const entity of (data.entities??[]).slice(0,60)){
        const result=inspectCoverage(data.metadata,data.scope,entity.id,select.value),button=doc.createElement('button');
        button.type='button';button.textContent=`${{unknown:'?',missing:'/',unsupported:'×',available:'✓'}[result.state]} ${entity.id}`;
        button.setAttribute('aria-label',`${entity.id}: ${result.state}`);
        button.onclick=()=>{output.textContent=`${entity.id} · ${select.value}\n${result.state}: ${result.reason}\nNeeded: ${result.needed}\nEvidence: ${result.evidence}\nMetadata revision: ${result.revision??'unavailable'}\nNo probability, causation or population count is inferred.`;};
        terrain.append(button);
      }
      if(!terrain.childElementCount)output.textContent='Unknown: no mapped entities available. Load a World region and refresh.';
    }catch{output.textContent='Coverage unavailable: adapter failed. Retry Refresh coverage. No values inferred.';}
  }
  const toggle=()=>{if(root.open)render();},key=event=>{if(event.key==='Escape'){root.open=false;root.querySelector('summary').focus();}};
  root.addEventListener('toggle',toggle);root.addEventListener('keydown',key);refresh.addEventListener('click',render);select.addEventListener('change',render);
  return {getState:()=>({disposed,tiles:terrain.childElementCount}),destroy(){disposed=true;root.removeEventListener('toggle',toggle);root.removeEventListener('keydown',key);refresh.removeEventListener('click',render);select.removeEventListener('change',render);terrain.replaceChildren();root.remove();}};
}
