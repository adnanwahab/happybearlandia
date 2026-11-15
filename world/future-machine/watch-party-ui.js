import {createRunReceipt} from './share/run-receipt.js';
import {presentation} from './watch-party.js';

export function mountWatchParty(container,{getContext,apply,fetcher=fetch}) {
  const root=document.createElement('section');root.className='fm-watch-party';root.setAttribute('aria-label','Future Watch Party');
  root.innerHTML='<h2>Future Watch Party</h2><p>Share presentation with one invited viewer. Both must open the same saved comparison first. Invitations are private bearer capabilities; share only with your intended viewer. Nothing is saved by this feature. Reactions are cosmetic, not model evidence.</p><button type="button" data-action="host">Start party</button> <label>Private invitation <input autocomplete="off" spellcheck="false" maxlength="64"></label> <button type="button" data-action="join">Join party</button> <button type="button" data-action="follow">Follow host</button> <button type="button" data-action="independent">Take independent control</button> <button type="button" data-action="leave">Leave / end party</button><p data-receipt></p><p role="status" aria-live="polite"></p><fieldset><legend>Cosmetic reactions</legend><button type="button" data-reaction="heart">Heart</button> <button type="button" data-reaction="wow">Wow</button> <button type="button" data-reaction="question">Question</button></fieldset><p data-reactions></p>';
  root.style.cssText='margin:16px;padding:16px;border:1px solid #73849c;border-radius:12px;overflow-wrap:anywhere';
  root.querySelector('input').style.maxWidth='100%';
  container.append(root);
  const input=root.querySelector('input'),status=root.querySelector('[role=status]'),receiptText=root.querySelector('[data-receipt]');
  let session=null,disposed=false,busy=false,generation=0,following=false,lastApplied=null,knownHistory=null,receipt=null;
  const say=text=>{if(status.textContent!==text)status.textContent=text;};
  const controls=()=>{input.readOnly=Boolean(session?.host);root.querySelector('[data-action=host]').disabled=Boolean(session);root.querySelector('[data-action=join]').disabled=Boolean(session);for(const name of ['follow','independent','leave'])root.querySelector(`[data-action=${name}]`).disabled=!session;for(const button of root.querySelectorAll('[data-reaction]'))button.disabled=!session;};
  controls();
  async function request(path,{method='GET',body,capability}={}){
    const response=await fetcher('/api/future-watch/'+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(capability?{Authorization:'Bearer '+capability}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000),cache:'no-store'});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Watch party unavailable');return data;
  }
  async function identity(){const {history}=getContext();if(!history?.experimentId)throw Error('Open a completed saved comparison first');if(history!==knownHistory){const result=await createRunReceipt(history,{month:0});if(getContext().history!==history)throw Error('Comparison changed; retry');receipt=result.checksum;knownHistory=history;}return receipt;}
  function view(){return presentation(getContext().view);}
  function leave(){generation++;session=null;following=false;lastApplied=null;input.value='';receiptText.textContent='';controls();}
  async function start(host){
    if(busy||session)return;busy=true;const attempt=++generation;
    try{const digest=await identity();let next;
      if(host){const result=await request('rooms',{method:'POST',body:{receipt:digest,view:view()}});next={capability:result.host,host:true,history:knownHistory};if(attempt===generation)input.value=result.invite;}
      else{const capability=input.value.trim();if(!/^[a-f0-9]{64}$/.test(capability))throw Error('Enter the private invitation');const data=await request('state',{capability});if(data.receipt!==digest)throw Error('Receipt mismatch. Open the host’s exact saved comparison and retry.');next={capability,host:false,history:knownHistory};}
      if(disposed||attempt!==generation)return;
      session=next;following=!host;lastApplied=JSON.stringify(view());receiptText.textContent='Matched canonical-run-receipt.v1 · '+digest;say(host?'Party started. Manually share the private invitation. Expires after 30 minutes.':'Receipt matched. Following host.');controls();
    }catch(error){if(attempt===generation)say(error.message);}finally{busy=false;}
  }
  root.onclick=async event=>{
    const button=event.target.closest('button');if(!button)return;
    const action=button.dataset.action;
    if(action==='host'||action==='join')return start(action==='host');
    if(action==='leave'){const old=session;leave();say('Party left. Your run is unchanged.');if(old?.host)try{await request('state',{method:'DELETE',capability:old.capability});}catch{}return;}
    if(action==='follow'){if(session&&!session.host){following=true;lastApplied=JSON.stringify(view());say('Following host.');}return;}
    if(action==='independent'){following=false;say('Independent control. Choose Follow host to resynchronize.');return;}
    if(button.dataset.reaction&&session)try{await request('state',{method:'POST',capability:session.capability,body:{reaction:button.dataset.reaction}});}catch(error){say(error.message);}
  };
  async function tick(){
    if(disposed||busy||!session)return;busy=true;const current=session;
    try{
      if(getContext().history!==current.history){leave();say('Comparison changed. Party detached; create or join again.');return;}
      if(current.host)await request('state',{method:'POST',capability:current.capability,body:view()});
      else if(following&&lastApplied!==JSON.stringify(view())){following=false;say('Independent control. Choose Follow host to resynchronize.');}
      const data=await request('state',{capability:current.capability});
      if(disposed||session!==current||getContext().history!==current.history)return;
      if(data.receipt!==receipt)throw Error('Receipt mismatch; presentation ignored');
      if(!current.host&&following){if(lastApplied!==JSON.stringify(view())){following=false;say('Independent control. Choose Follow host to resynchronize.');}else{const compatible=apply(presentation(data.view));lastApplied=JSON.stringify(view());say(compatible===false?'Following month and branch. Camera unavailable or incompatible with this renderer.':'Receipt matched. Following host.');}}
      root.querySelector('[data-reactions]').textContent='Cosmetic reactions: '+data.reactions.map(row=>row.kind).join(', ');
    }catch(error){if(session===current)say(error.message+' · Your run is unchanged. Retrying connection.');}finally{busy=false;}
  }
  const timer=setInterval(tick,500);
  return {dispose(){disposed=true;leave();clearInterval(timer);root.onclick=null;root.remove();}};
}
