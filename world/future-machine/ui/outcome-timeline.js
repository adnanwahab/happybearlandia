import {METRIC_UNITS, MONTHS, assertMonth} from '../contracts.js';

const LABELS={housingUnits:'Homes',meanRent:'Mean unit rent',capitalSpending:'Capital spending',meanTravelMinutes:'Mean link travel time',availableUnits:'Available homes',completedProjects:'Completed projects'};
const finite=value=>typeof value==='number' && Number.isFinite(value)?value:null;
const exact=(value,unit)=>value===null?'Unavailable':`${Object.is(value,-0)?0:value} ${unit}`;

/** Read recorded metrics only. Missing months are gaps, never simulated or zero-filled. */
export function buildOutcomeSeries(history,key) {
  if(!Object.hasOwn(METRIC_UNITS,key))throw new Error('Unsupported outcome metric');
  const maps=['baseline','plan'].map(arm=>{
    if(!Array.isArray(history?.[arm]) || history[arm].length>MONTHS+1)throw new Error('Two bounded monthly histories required');
    const result=new Map();
    for(const snapshot of history[arm]){
      if(snapshot==null)continue;
      assertMonth(snapshot.month);
      if(result.has(snapshot.month))throw new Error('Duplicate recorded month');
      result.set(snapshot.month,finite(snapshot.metrics?.[key]));
    }
    return result;
  });
  return Array.from({length:MONTHS+1},(_,month)=>{
    const baseline=maps[0].get(month)??null,plan=maps[1].get(month)??null;
    return {month,baseline,plan,delta:baseline===null||plan===null?null:finite(plan-baseline),unit:METRIC_UNITS[key]};
  });
}

/** Renderer-independent recorded outcome chart. Recreate for a different history. */
export function createOutcomeTimeline(container,{history,onMonth}={}) {
  const doc=container.ownerDocument,ns='http://www.w3.org/2000/svg';
  const series=new Map(Object.keys(METRIC_UNITS).map(key=>[key,buildOutcomeSeries(history,key)]));
  const supported=[...series].filter(([,rows])=>rows.some(row=>row.baseline!==null||row.plan!==null)).map(([key])=>key);
  if(!supported.length)supported.push('housingUnits');
  let month=-1,mode='comparison',key=supported.includes('housingUnits')?'housingUnits':supported[0],disposed=false;
  const node=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  const shell=node('section');shell.className='fm-outcome-timeline';shell.setAttribute('aria-label','Recorded outcome timeline');
  const style=node('style',`.fm-outcome-timeline{box-sizing:border-box;max-width:100%;min-width:0;padding:14px;border:1px solid #304358;border-radius:12px;color:#eaf2f8;background:#10202e;font:13px/1.5 system-ui}.fm-outcome-timeline *{box-sizing:border-box}.fm-outcome-timeline h2{font-size:16px;margin:0 0 10px}.fm-outcome-timeline select{font:inherit;max-width:100%;width:100%;min-height:40px;background:#182a3c;color:inherit;border:1px solid #7890a3;border-radius:6px;padding:6px}.fm-outcome-timeline svg{display:block;width:100%;height:auto;max-height:180px;touch-action:pan-y}.fm-outcome-timeline svg:focus-visible,.fm-outcome-timeline :focus-visible{outline:3px solid #83ceff;outline-offset:2px}.fm-outcome-timeline p{margin:8px 0;overflow-wrap:anywhere;white-space:pre-line}.fm-outcome-timeline input{width:100%;min-height:32px}.fm-outcome-timeline .fm-outcome-scroll{max-height:220px;overflow:auto}.fm-outcome-timeline table{border-collapse:collapse;width:100%;font:inherit}.fm-outcome-timeline td,.fm-outcome-timeline th{text-align:left;padding:5px;border-bottom:1px solid #304358;overflow-wrap:anywhere}.fm-outcome-timeline table button{font:inherit;color:#d6eaff;background:#182a3c;border:1px solid #7890a3;min-height:32px}.fm-outcome-timeline summary{cursor:pointer}.fm-outcome-timeline .fm-outcome-note{color:#adbed0;font-size:12px}`);
  const label=node('label','Recorded metric '),select=node('select');select.setAttribute('aria-label','Recorded outcome metric');
  for(const metric of supported){const option=node('option',`${LABELS[metric]||metric} · ${METRIC_UNITS[metric]}`);option.value=metric;select.append(option);}select.value=key;label.append(select);
  const modeLabel=node('label','Series mode '),modeSelect=node('select');modeSelect.setAttribute('aria-label','Outcome series mode');for(const [value,text] of [['comparison','Comparison'],['delta','Delta (WITH − WITHOUT)']]){const option=node('option',text);option.value=value;modeSelect.append(option);}modeLabel.append(modeSelect);
  const legend=node('p');
  const chart=doc.createElementNS(ns,'svg');chart.setAttribute('viewBox','0 0 600 180');chart.setAttribute('role','img');chart.setAttribute('aria-label','Without plan and with plan recorded values. Use the month slider or exact-values table to select a month.');
  const summary=node('p');summary.setAttribute('aria-live','polite');summary.className='fm-outcome-values';
  const sliderLabel=node('label','Outcome month '),slider=node('input');slider.type='range';slider.min='0';slider.max=String(MONTHS);slider.step='1';slider.setAttribute('aria-label','Outcome month');sliderLabel.append(slider);
  const note=node('p');note.className='fm-outcome-note';
  const details=node('details'),scroll=node('div'),table=node('table');scroll.className='fm-outcome-scroll';details.append(node('summary','Exact recorded values and month selection'),scroll);scroll.append(table);
  shell.append(style,node('h2','How outcomes diverge'),label,modeLabel,legend,chart,sliderLabel,summary,note,details);container.append(shell);
  function choose(next){if(disposed)return;const row=series.get(key)[next];if(!row || (row.baseline===null&&row.plan===null))return;update(next);onMonth?.(next);}
  function renderChart(rows){
    chart.replaceChildren();const values=(mode==='delta'?rows.map(row=>row.delta):rows.flatMap(row=>[row.baseline,row.plan])).filter(value=>value!==null);if(mode==='delta')values.push(0);
    let min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):1;if(min===max){min-=1;max+=1;}
    const x=m=>20+m/MONTHS*560,y=value=>150-(value-min)/(max-min)*130;
    if(mode==='delta'){const zero=doc.createElementNS(ns,'line');for(const [attr,value] of Object.entries({x1:20,x2:580,y1:y(0),y2:y(0),stroke:'#adbed0','stroke-dasharray':'3 3'}))zero.setAttribute(attr,value);zero.dataset.zeroAxis='true';chart.append(zero);}
    for(const [arm,color] of mode==='delta'?[['delta','#d6eaff']]:[['baseline','#8cc8ff'],['plan','#ffd29b']]){
      const path=doc.createElementNS(ns,'path');let d='',pen=false;
      for(const row of rows){if(row[arm]===null){pen=false;continue;}d+=`${pen?'L':'M'}${x(row.month)} ${y(row[arm])} `;pen=true;}
      path.setAttribute('d',d);path.setAttribute('stroke',color);path.setAttribute('stroke-width','2');path.setAttribute('fill','none');if(arm==='plan')path.setAttribute('stroke-dasharray','6 4');chart.append(path);
      for(const row of rows){if(row[arm]===null)continue;const point=doc.createElementNS(ns,'circle');point.setAttribute('cx',x(row.month));point.setAttribute('cy',y(row[arm]));point.setAttribute('r',row.month===month?'5':'2');point.setAttribute('fill',color);point.dataset.month=String(row.month);const title=doc.createElementNS(ns,'title');title.textContent=`Month ${row.month} · ${arm==='delta'?'DELTA (WITH − WITHOUT)':arm==='baseline'?'WITHOUT PLAN':'WITH PLAN'} ${exact(row[arm],row.unit)}`;point.append(title);chart.append(point);}
    }
    const axis=doc.createElementNS(ns,'text');axis.setAttribute('x','20');axis.setAttribute('y','174');axis.setAttribute('fill','#adbed0');axis.setAttribute('font-size','11');axis.textContent=`Month 0 → 120 · range ${min}–${max} ${METRIC_UNITS[key]}`;chart.append(axis);
  }
  function renderTable(rows){
    table.replaceChildren();const head=node('tr');for(const text of ['Month','WITHOUT PLAN','WITH PLAN','Delta'])head.append(node('th',text));table.append(head);
    for(const row of rows){const tr=node('tr'),cell=node('td'),button=node('button',String(row.month));button.type='button';button.dataset.month=String(row.month);button.disabled=row.baseline===null&&row.plan===null;button.setAttribute('aria-label',`Select recorded month ${row.month}`);cell.append(button);tr.append(cell);for(const value of [row.baseline,row.plan,row.delta])tr.append(node('td',exact(value,row.unit)));table.append(tr);}
  }
  function update(next,force=false){if(disposed)return;assertMonth(next);if(next===month&&!force)return;month=next;legend.textContent=mode==='delta'?'DELTA (WITH − WITHOUT) · pale blue · dashed zero axis · gaps mean unavailable':'WITHOUT PLAN — blue · WITH PLAN – – amber · gaps mean unavailable';chart.setAttribute('aria-label',mode==='delta'?'Recorded plan minus baseline differences with zero axis. Use the month slider or exact-values table to select a month.':'Without plan and with plan recorded values. Use the month slider or exact-values table to select a month.');const rows=series.get(key),row=rows[month];slider.value=String(month);slider.setAttribute('aria-valuetext',`Month ${month}`);summary.textContent=`Month ${month}\nWITHOUT PLAN: ${exact(row.baseline,row.unit)}\nWITH PLAN: ${exact(row.plan,row.unit)}\nDelta (WITH − WITHOUT): ${exact(row.delta,row.unit)}`;note.textContent='Recorded monthly model measurements; lines connect adjacent recorded months only. '+(key==='meanRent'?'Whole-stock mean includes new inventory; not incumbent rent savings.':key==='capitalSpending'?'Cumulative capital cost; an increase is spending, not a welfare gain.':'A difference alone does not establish a causal explanation.');renderChart(rows);}
  select.onchange=()=>{key=select.value;renderTable(series.get(key));update(month,true);};
  modeSelect.onchange=()=>{mode=modeSelect.value;update(month,true);};
  slider.oninput=()=>choose(Number(slider.value));
  const click=event=>{const point=event.target.closest?.('[data-month]');if(point)choose(Number(point.dataset.month));};chart.addEventListener('click',click);table.addEventListener('click',click);
  renderTable(series.get(key));update(0);
  return {update,dispose(){if(disposed)return;disposed=true;select.onchange=modeSelect.onchange=slider.oninput=null;chart.removeEventListener('click',click);table.removeEventListener('click',click);shell.remove();}};
}
