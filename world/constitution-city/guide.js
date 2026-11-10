const app=document.querySelector('#cc-app');
const observer=new MutationObserver(()=>{
 const controls=app.querySelector('.cc-controls');
 if(!controls||controls.querySelector('.city-presets'))return;
 const panel=document.createElement('section');panel.className='city-presets';panel.setAttribute('aria-label','Experiment presets');
 panel.innerHTML='<h2>Choose a starting experiment</h2><p>Presets update the controls below. Evaluate when ready.</p><div><button type="button" data-preset="quick">Quick comparison</button><button type="button" data-preset="delayed">Delayed rollout</button><button type="button" data-preset="partial">Partial adoption</button></div><p role="status" aria-live="polite" data-preset-status>No preset selected.</p>';
 panel.addEventListener('click',event=>{
 const key=event.target.closest('[data-preset]')?.dataset.preset;if(!key)return;
 const settings={quick:[1,0,0,2,5],delayed:[1,24,0,2,10],partial:[.5,0,5,2,10]}[key];
 ['compliance','delay','sunset','runs','years'].forEach((name,index)=>{const field=controls.querySelector(`[data-cc-${name}]`);field.value=String(settings[index]);field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));});
 panel.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.preset===key)));
 panel.querySelector('[data-preset-status]').textContent=key==='quick'?'Ready: 2 futures per scenario over 5 years.':key==='delayed'?'Ready: Proposal B starts after 24 months.':'Ready: Proposal B uses 50% compliance and a 5-year sunset.';
 });controls.prepend(panel);
});observer.observe(app,{childList:true,subtree:true});
addEventListener('pagehide',()=>observer.disconnect(),{once:true});
