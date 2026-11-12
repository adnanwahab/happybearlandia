/** Canvas-only navigation. The coordinator remains the selected-month authority. */
export function bindYearShortcuts(host, {getState, getDiffs, onMonth, onMissing}) {
  function keydown(event) {
    const target=event.target;
    if(target?.tagName!=='CANVAS' || target.ownerDocument.activeElement!==target || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)return;
    const state=getState();
    if(state.status!=='ready'&&!(state.status==='error'&&state.frame))return;
    let month;
    if(event.key==='PageUp')month=Math.min(120,state.month+12);
    else if(event.key==='PageDown')month=Math.max(0,state.month-12);
    else if(event.key.toLowerCase()==='d')month=getDiffs().find(diff=>diff.available!==false && diff.changedCount>0)?.month;
    else return;
    event.preventDefault();
    if(month===undefined)onMissing();else onMonth(month);
  }
  host.addEventListener('keydown',keydown);
  return ()=>host.removeEventListener('keydown',keydown);
}
