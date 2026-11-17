/** Narrow command grammar; no generated answers or transcript storage. */
export function voiceQuery(text) {
  const value=String(text).toLowerCase().trim().replace(/[?.!]+$/,'');
  if(value==='why did rent change')return 'why rent';
  return value.replace(/^(show|open|find) (the )?/,'');
}

/** Requires the browser's explicit on-device contract. Never fall back to cloud. */
export function mountVoiceInput(dialog,{onQuery}) {
  const doc=dialog.ownerDocument,win=doc.defaultView;
  const button=doc.createElement('button');button.type='button';button.textContent='Use voice';
  const notice=doc.createElement('p');notice.setAttribute('aria-live','polite');
  notice.textContent='Optional on-device voice (English). No audio upload or saved transcript. Review matches before confirming.';
  dialog.querySelector('header').after(button,notice);
  let active=null,timer=null,disposed=false;
  function cancel(){
    const previous=active;active=null;
    if(timer!==null)win.clearTimeout(timer);timer=null;
    if(previous){previous.onresult=previous.onerror=previous.onend=null;try{previous.abort();}catch{}}
    button.textContent='Use voice';
  }
  function fallback(message){cancel();notice.textContent=message+' Use typed command search instead.';dialog.querySelector('input').focus();}
  button.onclick=()=>{
    if(active){cancel();notice.textContent='Voice cancelled. No transcript retained.';return;}
    try{
      const Recognition=win.SpeechRecognition||win.webkitSpeechRecognition;
      if(!Recognition)return fallback('On-device speech is unavailable.');
      const recognition=new Recognition();
      if(!('processLocally' in recognition))return fallback('On-device speech is unavailable.');
      recognition.processLocally=true;
      if(recognition.processLocally!==true)return fallback('On-device speech is unavailable.');
      recognition.lang='en-US';recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
      active=recognition;
      recognition.onresult=event=>{
        if(disposed||active!==recognition)return;
        const result=event.results?.[event.resultIndex??0];
        if(!result?.isFinal)return;
        const query=voiceQuery(result[0]?.transcript??'');cancel();
        notice.textContent='Voice finished. Review matches; nothing has been executed.';
        if(query)onQuery(query);else fallback('No command heard.');
      };
      recognition.onerror=()=>{if(active===recognition)fallback('Voice unavailable or microphone access denied.');};
      recognition.onend=()=>{if(active===recognition)fallback('No command heard.');};
      button.textContent='Cancel voice';notice.textContent='Listening on this device…';
      timer=win.setTimeout(()=>fallback('Voice timed out.'),15000);
      recognition.start();
    }catch{fallback('Voice could not start.');}
  };
  function visibility(){if(doc.hidden)cancel();}
  doc.addEventListener('visibilitychange',visibility);win.addEventListener('pagehide',cancel);
  return {cancel,dispose(){disposed=true;cancel();doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('pagehide',cancel);button.remove();notice.remove();}};
}
