import {MONTHS, assertMonth} from '../contracts.js';
import {householdObservation} from './model.js';

const fields=['unitId','income','savings','rent','burden'];
/** Exact monthly observations; compare only adjacent observed months. */
export function householdTimeline(history,id) {
  const arms=['baseline','plan'].map(arm=>{
    const map=new Map();
    for(const snapshot of history[arm] ?? []) {
      if(!snapshot)continue;
      const month=snapshot.month ?? snapshot.state?.month;
      assertMonth(month);
      if(map.has(month))throw new Error('Duplicate household observation month');
      if(snapshot.state && (snapshot.state.month!==month || snapshot.state.version!==history.modelVersion || snapshot.state.seed!==history.seed))throw new Error('Household history provenance mismatch');
      const matches=snapshot.state?.households?.filter(row=>row.id===id) ?? [];
      map.set(month,matches.length===1?householdObservation(matches[0],snapshot.state.units):null);
    }
    return map;
  });
  return Array.from({length:MONTHS+1},(_,month)=>{
    const values=arms.map(map=>map.get(month)??null);
    const changes=arms.map((map,i)=>{
      const before=map.get(month-1),after=values[i];
      return before && after ? fields.filter(key=>before[key]!=null && after[key]!=null && before[key]!==after[key]) : [];
    });
    return {month,baseline:values[0],plan:values[1],changes};
  });
}

export function createHouseholdTimeline(container,{history,onMonth}={}) {
  const doc=container.ownerDocument;
  const node=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  const shell=node('section');shell.setAttribute('aria-label','Household change timeline');
  const label=node('label','City household '),select=node('select');select.setAttribute('aria-label','Timeline household');label.append(select);
  const ids=[...new Set(['baseline','plan'].flatMap(arm=>(history[arm]??[]).flatMap(s=>s?.state?.households?.map(h=>h.id)??[])))].sort();
  for(const id of ids){const option=node('option',id);option.value=id;select.append(option);}select.value=ids[0]??'';
  let rows=ids.length?householdTimeline(history,ids[0]):[],month=0,disposed=false;
  const provenance=node('p',`RUN ${history.experimentId??'Unavailable'} · SEED ${history.seed??'Unavailable'} · MODEL ${history.modelVersion??'Unavailable'}`);
  const values=node('p');values.className='fm-household-values';values.style.whiteSpace='pre-line';
  const announcement=node('span');announcement.setAttribute('aria-live','polite');announcement.dataset.householdAnnouncement='true';announcement.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
  const previous=node('button','Previous household change'),next=node('button','Next household change');previous.type=next.type='button';
  const table=node('table'),head=node('tr');for(const text of ['Recorded month','WITHOUT PLAN changes','WITH PLAN changes'])head.append(node('th',text));table.append(head);
  const body=node('tbody');table.append(body);const details=node('details');details.append(node('summary','All recorded household changes'),table);
  shell.append(node('h2','One household, two futures'),label,provenance,previous,next,values,announcement,details,node('p','Synthetic monthly City observations, including recomputed history. Changes compare adjacent observed months; missing months and unmatched households are unavailable. Unit IDs are City homes, with no House Simulator mapping. Changes alone do not establish cause.'));container.append(shell);
  let changeStops=[];
  function update(value,{announce=false}={}){
    if(disposed)return;assertMonth(value);month=value;
    const row=rows[month];
    const format=arm=>{const v=row?.[arm];return v?`Home ${v.unitId??'Unavailable'} · income ${v.income??'Unavailable'} USD/month · savings ${v.savings??'Unavailable'} USD · rent ${v.rent??'Unavailable'} USD/month`:'Unavailable — no matched observation';};
    const text=`${select.value||'No households'} · Month ${month}\nWITHOUT PLAN: ${format('baseline')}\nWITH PLAN: ${format('plan')}`;
    if(values.textContent!==text)values.textContent=text;
    if(announce&&announcement.textContent!==text)announcement.textContent=text;
    previous.disabled=!changeStops.some(row=>row.month<month);next.disabled=!changeStops.some(row=>row.month>month);
  }
  function choose(value){if(disposed)return;update(value,{announce:true});onMonth?.(value);}
  function render(){changeStops=rows.filter(row=>row.changes.some(list=>list.length));body.replaceChildren();for(const row of changeStops){const tr=node('tr'),cell=node('td'),button=node('button',String(row.month));button.type='button';button.onclick=()=>choose(row.month);cell.append(button);tr.append(cell,...row.changes.map(list=>node('td',list.join(', ')||'No recorded change')));body.append(tr);}update(month,{announce:true});}
  previous.onclick=()=>{const stop=changeStops.filter(row=>row.month<month).at(-1);if(stop)choose(stop.month);};
  next.onclick=()=>{const stop=changeStops.find(row=>row.month>month);if(stop)choose(stop.month);};
  select.onchange=()=>{if(disposed)return;rows=householdTimeline(history,select.value);render();onMonth?.(month);};select.disabled=!ids.length;render();
  return {update,dispose(){if(disposed)return;disposed=true;select.onchange=previous.onclick=next.onclick=null;shell.remove();}};
}
