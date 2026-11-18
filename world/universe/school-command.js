/** Presentation adapter over the same versioned World frame used by Tile view.
 * A single school is selected by source order, never by inferred coordinates.
 */
export function schoolTarget(frame){
 if(!frame?.runId||!frame.geometryKey)return null;
 const school=frame.buildings?.find(b=>b.kind==='school'&&b.id!=null);
 if(!school||frame.buildings.filter(b=>String(b.id)===String(school.id)).length!==1)return null;
 return {id:String(school.id),name:school.name||String(school.id),scope:JSON.stringify([frame.runId,frame.geometryKey,String(school.id)])};
}
export function mountSchoolCommand(container,{getSource,onUnavailable}){
 const button=container.ownerDocument.createElement('button');button.type='button';button.dataset.paletteAction='inspect';container.append(button);
 function refresh(){const target=schoolTarget(getSource()?.getFrame?.());button.disabled=!target;button.textContent=target?`Show school · ${target.name}`:'Show school · unavailable';button.dataset.paletteContext=target?.scope??'';}
 button.onclick=()=>{
  const source=getSource(),target=schoolTarget(source?.getFrame?.());
  if(!target||target.scope!==button.dataset.paletteContext||!source?.selectBuilding){refresh();onUnavailable();return;}
  source.selectBuilding(target.id);
 };
 refresh();return {refresh,dispose(){button.remove();}};
}
