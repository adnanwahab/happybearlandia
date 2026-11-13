import {computeEffectsForYear} from './policy.js';

export const LEVERS = [
  ['speedMult','🚌','Transit speed multiplier',1,2.6,.01],
  ['floodMitigation','🌊','Flood mitigation',0,.45,.01],
  ['housingGrowth','🏠','Housing growth',0,1.8,.01],
  ['voucherMonthly','💵','Vouchers per month',0,120,1],
];
export const customPlan = () => ({id:'custom',label:'Make my own',source:'local',proposalIds:[],customEffects:Object.fromEntries(LEVERS.map(([key,,,min])=>[key,min]))});
export function stagePlan(plan, year) {
  const staged=computeEffectsForYear(plan.proposalIds||plan.ids||[],year);
  if(plan.customEffects) for(const [key,,,min,max] of LEVERS){
    const value=plan.customEffects[key];
    if(!Number.isFinite(value)||value<min||value>max)throw new Error('Invalid custom lever: '+key);
    staged.effects[key]=value;
  }
  return staged;
}
export function leverValue(key,value){return key==='speedMult'?'×'+String(Number(value.toFixed(10))):key==='voucherMonthly'?'$'+value+'/mo':String(Number((value*100).toFixed(10)))+'%';}
export function expectation(e){return `What to look for in the configuration: transit ${leverValue('speedMult',e.speedMult)}, flood mitigation ${leverValue('floodMitigation',e.floodMitigation)}, housing growth ${leverValue('housingGrowth',e.housingGrowth)}, vouchers ${leverValue('voucherMonthly',e.voucherMonthly)}. Outcomes require a run.`;}

// Keep the existing policy value/change interface for tours and saved checkpoints.
export function mountPlanChoices({select,host,packages,year,onCustom}){
  const doc=host.ownerDocument;
  function render(){
    const focused=doc.activeElement?.name==='world-plan-choice'?doc.activeElement.value:null;
    const selected=select.value, rows=packages();
    host.replaceChildren();
    const group=doc.createElement('fieldset'),legend=doc.createElement('legend');legend.textContent='Plan package · year '+year();group.append(legend);host.append(group);
    for(const [id,plan] of Object.entries(rows)){
      if(id.startsWith('cycle-'))continue;
      const card=doc.createElement('div');card.className='plan-choice';
      const label=doc.createElement('label'),radio=doc.createElement('input');radio.type='radio';radio.name='world-plan-choice';radio.value=id;radio.checked=id===selected;
      const title=doc.createElement('strong');title.textContent=plan.label;
      label.append(radio,title);card.append(label);
      const effects=stagePlan(plan,year()).effects;
      const description=doc.createElement('p');description.id='plan-description-'+id;description.textContent=expectation(effects);radio.setAttribute('aria-describedby',description.id);
      for(const [key,icon,text] of LEVERS){
        const line=doc.createElement('div');line.className='plan-lever';line.dataset.lever=key;
        const symbol=doc.createElement('span');symbol.textContent=icon;symbol.setAttribute('aria-hidden','true');line.append(symbol);
        const caption=doc.createElement('span');caption.textContent=text+': '+leverValue(key,effects[key]);line.append(caption);card.append(line);
      }
      card.append(description);
      const extra=Object.entries(effects).filter(([key,value])=>!LEVERS.some(([k])=>k===key)&&value!==0);
      if(extra.length){const note=doc.createElement('p');note.textContent='Additional mechanisms: '+extra.map(([k,v])=>k+' '+v).join(', ');card.append(note);}
      if(stagePlan(plan,year()).unsupported.length){const note=doc.createElement('p');note.textContent='Not simulated: '+stagePlan(plan,year()).unsupported.join(', ');card.append(note);}
      if(/popular/i.test(plan.label)){
        const note=doc.createElement('p'),link=doc.createElement('a');
        note.textContent=plan.source==='dear-congress'?'Civic Synthesis package; voter population and vote counts are not supplied here. ':'Fixed local preset; no measured popularity or voter population is available. ';
        link.href=plan.source==='dear-congress'?'/api/plan':'/world/plan-choices-source.html';link.textContent='Package source';note.append(link);card.append(note);
      }
      radio.addEventListener('change',()=>{select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));});
      if(id==='custom'&&selected===id){
        for(const [key,,text,min,max,step] of LEVERS){
          const lab=doc.createElement('label');lab.textContent=text;
          const input=doc.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=effects[key];input.setAttribute('aria-label',text);
          const output=doc.createElement('output');output.textContent=leverValue(key,effects[key]);input.setAttribute('aria-valuetext',output.textContent);
          input.addEventListener('input',()=>{plan.customEffects[key]=Number(input.value);output.textContent=leverValue(key,Number(input.value));input.setAttribute('aria-valuetext',output.textContent);description.textContent=expectation(stagePlan(plan,year()).effects);card.querySelector('[data-lever="'+key+'"] span:last-child').textContent=text+': '+output.textContent;onCustom();});
          lab.append(input,output);card.append(lab);
        }
      }
      group.append(card);
    }
    const note=doc.createElement('p');note.textContent='Synthetic legacy rules. Housing growth is recorded configuration; the weekly model does not build housing. Flood mitigation is used by the separate Storm action. Run cycle measures a matched week; the 10-year experiment is separate.';host.append(note);
    if(focused)Array.from(host.querySelectorAll('input[type=radio]')).find(input=>input.value===focused)?.focus();
  }
  select.addEventListener('change',render);render();return {render};
}
