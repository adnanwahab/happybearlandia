/** Camera presentation only. Call from the existing frame loop; owns no clock. */
export function createSceneArrival({camera, controls, enabled, reducedMotion}) {
  let done=!enabled,start=null;
  function reveal() {
    camera.position.set(22,18,32);
    controls.target.set(0,8,0);
    controls.update?.();
    done=true;
  }
  function update(now) {
    if(done)return;
    if(reducedMotion()){reveal();return;}
    start??=now;
    const t=Math.min(1,Math.max(0,(now-start)/2600)),ease=1-(1-t)**3;
    camera.position.set(320*(1-ease)+22*ease,3000*(1-ease)+18*ease,450*(1-ease)+32*ease);
    controls.target.set(0,8,0);
    if(t===1)done=true;
  }
  if(enabled&&reducedMotion())reveal();
  return {update,cancel(){done=true;},get done(){return done;}};
}

/** A stable, nonmodal equivalent to the camera's spatial journey. */
export function mountSceneContext({container,preferences}) {
  const doc=container.ownerDocument,card=doc.createElement('div');
  card.dataset.sceneContext='';
  card.style.cssText='margin:8px 0;padding:10px;border:1px solid var(--accent);border-radius:8px';
  const label=doc.createElement('label'),check=doc.createElement('input');
  check.type='checkbox';check.style.cssText='min-width:24px;min-height:24px;vertical-align:middle';
  label.append(check,' Reduce scene motion');
  const context=doc.createElement('p');context.setAttribute('role','status');
  context.style.margin='6px 0 0';
  check.onchange=()=>preferences.set({motion:check.checked?'reduce':'system'});
  card.append(label,context);container.append(card);
  const off=preferences.subscribe(({reducedMotion})=>{
    check.checked=reducedMotion;
    context.textContent=reducedMotion?'Still view: arrival reveals immediately. Legacy resident Follow frames once. The selection ring and inspector keep the selected object in context.':'Scene motion follows your device preference. Selection details remain in the inspector.';
  });
  return {dispose(){off();card.remove();}};
}
