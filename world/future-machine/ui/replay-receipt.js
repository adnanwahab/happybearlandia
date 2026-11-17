import {createRunReceipt} from '../share/run-receipt.js';

/** Uses only the bounded synthetic City history, never account or page data. */
export function mountReplayReceipt(root, {getContext, onReopen}) {
  const doc=root.ownerDocument;
  const panel=doc.createElement('details');
  const summary=doc.createElement('summary');summary.textContent='Replay receipt';
  const note=doc.createElement('p');note.textContent='Synthetic, uncalibrated monthly City results. Inspect model version, seed, policy inputs and recorded event provenance. Reopening requires the saved experiment on this service and verifies its digests; no fallback. A checksum detects corruption, not proof of origin.';
  const output=doc.createElement('textarea');output.readOnly=true;output.rows=14;output.style.width='100%';output.style.boxSizing='border-box';output.setAttribute('aria-label','Current replay receipt');
  const input=doc.createElement('textarea');input.rows=6;input.maxLength=4_500_000;input.style.width='100%';input.style.boxSizing='border-box';input.setAttribute('aria-label','Paste replay receipt');
  const status=doc.createElement('p');status.setAttribute('role','status');
  const inspect=doc.createElement('button');inspect.type='button';inspect.textContent='Inspect current receipt';
  const copy=doc.createElement('button');copy.type='button';copy.textContent='Copy receipt';copy.disabled=true;
  const reopen=doc.createElement('button');reopen.type='button';reopen.textContent='Reopen receipt';
  let generation=0, busy=false, reopening=false, available=false, disposed=false;
  function controls(){inspect.disabled=busy||reopening||!available;copy.disabled=busy||reopening||!output.value;reopen.disabled=busy||reopening;}
  inspect.onclick=async()=>{
    const current=++generation, context=getContext();busy=true;controls();
    try {
      const receipt=await createRunReceipt(context.history,{month:context.month});
      if(disposed||current!==generation)return;
      output.value=JSON.stringify(receipt,null,2);status.textContent=`Receipt for seed ${receipt.evidence.seed}, Month ${receipt.evidence.month}. Copy or select the JSON below.`;
    } catch(error){if(!disposed&&current===generation)status.textContent=error.message;}
    finally {if(!disposed&&current===generation){busy=false;controls();}}
  };
  copy.onclick=async()=>{
    try {await doc.defaultView.navigator.clipboard.writeText(output.value);if(!disposed)status.textContent='Replay receipt copied.';}
    catch {if(!disposed){output.focus();output.select();status.textContent='Clipboard unavailable. Copy the selected receipt text.';}}
  };
  reopen.onclick=async()=>{
    reopening=true;controls();status.textContent='Validating and reopening receipt…';
    try {
      if(input.value.length>4_500_000)throw new Error('Run receipt: exceeds export limit');
      const parsed=JSON.parse(input.value);
      if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Run receipt: expected a receipt object');
      await onReopen(parsed);
      if(!disposed)status.textContent='Receipt verified and reopened at its recorded month.';
    } catch(error){if(!disposed)status.textContent=`Receipt could not be reopened: ${error.message}`;}
    finally {if(!disposed){reopening=false;controls();}}
  };
  panel.append(summary,note,inspect,copy,output,input,reopen,status);root.append(panel);
  let previousHistory=null,previousMonth=null;
  return {
    update({history,month,ready}){
      available=ready;
      if(history!==previousHistory||month!==previousMonth||!ready){generation++;busy=false;output.value='';previousHistory=history;previousMonth=month;}
      controls();
    },
    dispose(){disposed=true;generation++;inspect.onclick=copy.onclick=reopen.onclick=null;panel.remove();}
  };
}
