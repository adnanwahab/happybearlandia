import { classifyDecisionOutcome } from './contracts.js';
// E2E hooks: [data-testid=decision-visualizations], [data-viz=landscape|worlds|
// distribution|comparison|pareto|replay], [data-control=x|y|z|metric|scenario|
// unfavorable|projection|rotation|page-prev|page-next|replay-year|replay-play],
// [data-run-id]. Only completed/successful runs enter the views. No model logic.
// update accepts previousResults; pairing requires equal modelId/modelVersion/years.
// onEnterFuture(run,{month,url}) preserves the exact selected stored snapshot.
// Additional controls: outcome,color,search,density,ghost,lasso,grid-size,best,median,worst,enter.
const COLORS = ['#087f7e', '#b96928', '#7862ad', '#bf4e67', '#3e779f', '#687c31'];
const finite = n => typeof n === 'number' && Number.isFinite(n);
const titleCase = s => String(s).replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
export function quantile(values, q) {
  const sorted = values.filter(finite).sort((a,b) => a-b);
  if (!sorted.length) return null;
  const i = Math.max(0, Math.min(1,q)) * (sorted.length - 1), lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i-lo);
}
export function histogram(values, count = 16, domain) {
  const data = values.filter(finite);
  if (!data.length) return [];
  count = Math.max(1,Math.min(100,Math.round(count) || 16));
  let [min,max] = domain || [Math.min(...data),Math.max(...data)];
  if (!finite(min) || !finite(max) || max < min) return [];
  if (min===max) {min-=Math.max(1,Math.abs(min)*.01);max+=Math.max(1,Math.abs(max)*.01)}
  const step=(max-min)/count;
  const bins=Array.from({length:count},(_,i)=>({min:min+i*step,max:min+(i+1)*step,count:0}));
  for(const value of data) if(value>=min && value<=max) bins[Math.min(count-1,Math.floor((value-min)/step))].count++;
  return bins;
}
// Deterministic proportional quotas preserve every scenario, even when runs
// arrive interleaved. One global stride can alias away entire scenarios.
export function stratifiedScenarioSample(rows, budget=1200) {
  if(rows.length<=budget)return rows.slice();
  const groups=new Map();for(const row of rows){if(!groups.has(row.scenarioId))groups.set(row.scenarioId,[]);groups.get(row.scenarioId).push(row)}
  const entries=[...groups.values()];const quotas=entries.map(group=>Math.max(1,Math.floor(group.length/rows.length*budget)));
  let remaining=budget-quotas.reduce((a,b)=>a+b,0);
  for(let i=0;remaining>0;i=(i+1)%entries.length)if(quotas[i]<entries[i].length){quotas[i]++;remaining--}
  const result=[];entries.forEach((group,i)=>{const quota=Math.min(quotas[i],group.length);for(let j=0;j<quota;j++)result.push(group[Math.floor(j*group.length/quota)])});return result;
}
export function paretoFront(rows, xKey, yKey, xDirection='lower-is-better', yDirection='higher-is-better') {
  const valid=rows.filter(row=>finite(row.metrics?.[xKey])&&finite(row.metrics?.[yKey]));
  const sx=['higher-is-better','higher','maximize'].includes(xDirection)?-1:1, sy=['lower-is-better','lower','minimize'].includes(yDirection)?1:-1;
  return valid.filter(a=>!valid.some(b=>b!==a && sx*b.metrics[xKey]<=sx*a.metrics[xKey] && sy*b.metrics[yKey]<=sy*a.metrics[yKey] && (b.metrics[xKey]!==a.metrics[xKey]||b.metrics[yKey]!==a.metrics[yKey]))).sort((a,b)=>a.metrics[xKey]-b.metrics[xKey]);
}
export function futureOutcome(run, scenario={}) {
  const recorded=typeof run?.outcome==='string'?run.outcome:run?.outcome?.status;
  if(['success','mixed','failure','unclassified'].includes(recorded))return recorded;
  return classifyDecisionOutcome(run?.metrics||{},scenario);
}
export function compileFutureSearch(query, metrics=[]) {
  const text=String(query||'').trim().slice(0,300);
  if(!text)return {description:'All futures',test:()=>true};
  const clauses=text.split(/\s+and\s+/i),checks=[];
  for(let clause of clauses){
    clause=clause.toLowerCase().replace(/^(show|find)\s+(me\s+)?/,'').replace(/^(futures|worlds)\s+(where|with|that have)\s+/,'').trim();
    if(/^(success(es|ful)?|failure(s)?|mixed)$/.test(clause)){const outcome=clause.startsWith('success')?'success':clause.startsWith('failure')?'failure':'mixed';checks.push((r,s)=>futureOutcome(r,s)===outcome);continue}
    const match=clause.match(/^(.+?)\s*(<=|>=|<|>|=|below|under|less than|above|over|greater than|at least|at most)\s*\$?(-?\d[\d,]*(?:\.\d+)?)([kmb])?(%)?$/i);
    if(match){const needle=match[1].trim().replace(/[_-]/g,' ');const aliases={rent:'median_rent',cost:'public_expenditure',supply:'housing_supply',vacancy:'vacancy_rate'};let metric=metrics.find(m=>m.id===aliases[needle]||m.id.replace(/[_-]/g,' ')===needle||m.label?.toLowerCase()===needle);if(!metric){const candidates=metrics.filter(m=>m.id.replace(/[_-]/g,' ').includes(needle)||m.label?.toLowerCase().includes(needle));if(candidates.length===1)metric=candidates[0]}
      if(!metric)return {error:`Unknown or ambiguous metric “${match[1]}”. Use the metric selector’s exact name.`,test:()=>false};
      let threshold=Number(match[3].replaceAll(',',''))*({k:1e3,m:1e6,b:1e9}[match[4]?.toLowerCase()]||1);if(match[5]&&['fraction','probability'].includes(metric.unit))threshold/=100;
      const op=match[2];checks.push(r=>{const v=r.metrics?.[metric.id];return finite(v)&&(op==='='?v===threshold:['<','below','under','less than'].includes(op)?v<threshold:['<=','at most'].includes(op)?v<=threshold:['>','above','over','greater than'].includes(op)?v>threshold:v>=threshold)});continue;
    }
    if(/[<>=$]/.test(clause))return {error:'Use a metric comparison such as rent below 2000, cost < 2b, or vacancy above 5%.',test:()=>false};
    const needle=clause.replace(/^events?\s*:?\s*/,'');checks.push(r=>(r.events||[]).some(e=>(typeof e==='string'?e:[e.type,e.label,e.message,e.description].filter(Boolean).join(' ')).toLowerCase().replace(/[_-]/g,' ').includes(needle.replace(/[_-]/g,' '))));
  }
  return {description:`Recorded metrics/events matching “${text}”`,test:(r,s)=>checks.every(check=>check(r,s))};
}
export function pointsInPolygon(points, polygon) {
  if(polygon.length<3)return [];
  return points.filter(point=>{let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>point.y)!==(b[1]>point.y)&&point.x<(b[0]-a[0])*(point.y-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside});
}
export function densityContours(points, columns=24, rows=16) {
  const counts=Array.from({length:rows},()=>Array(columns).fill(0));let support=0;
  for(const p of points){if(!finite(p.x)||!finite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1)continue;counts[Math.min(rows-1,Math.floor(p.y*rows))][Math.min(columns-1,Math.floor(p.x*columns))]++;support++}
  const grid=counts.map((row,y)=>row.map((_,x)=>{let sum=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)sum+=(counts[y+dy]?.[x+dx]||0)*Math.exp(-(dx*dx+dy*dy)/2);return sum}));const max=Math.max(0,...grid.flat());
  const levels=max?[.25,.5,.75].map(fraction=>{const threshold=max*fraction,segments=[];for(let y=0;y<rows-1;y++)for(let x=0;x<columns-1;x++){const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],hits=[];for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],va=grid[a[1]][a[0]],vb=grid[b[1]][b[0]];if((va>=threshold)!==(vb>=threshold)){const t=(threshold-va)/(vb-va);hits.push([(a[0]+t*(b[0]-a[0])+.5)/columns,(a[1]+t*(b[1]-a[1])+.5)/rows])}}for(let i=0;i+1<hits.length;i+=2)segments.push([hits[i],hits[i+1]])}return {threshold,segments}}):[];return {counts,levels,support};
}
export function pairedMetricDeltas(current=[],previous=[],metricId) {
  const prior=new Map(previous.filter(r=>finite(r.metrics?.[metricId])).map(r=>[`${r.scenarioId}:${r.seed}`,r]));
  const pairs=current.filter(r=>finite(r.metrics?.[metricId])&&prior.has(`${r.scenarioId}:${r.seed}`)).map(r=>({current:r.metrics[metricId],previous:prior.get(`${r.scenarioId}:${r.seed}`).metrics[metricId]}));
  return {count:pairs.length,before:quantile(pairs.map(p=>p.previous),.5),after:quantile(pairs.map(p=>p.current),.5),medianDelta:quantile(pairs.map(p=>p.current-p.previous),.5)};
}
export function futureWorldURL(experiment,run,month=0) {
  const q=new URLSearchParams({decisionExperiment:experiment?.id||run?.experimentId||'',decisionRun:run?.id||'',month:String(Number.isFinite(Number(month))?Math.max(0,Math.round(Number(month))):0),demo:'1'});
  return `/world?${q}`;
}
const success = row => row && ['completed','successful','success','succeeded'].includes(row.status) && row.metrics && typeof row.metrics === 'object';

export function mountDecisionVisualizations(container, {onSelectRun,onEnterFuture} = {}) {
  if (!container?.ownerDocument) throw new TypeError('A DOM container is required');
  const doc=container.ownerDocument, root=doc.createElement('section');
  root.className='decision-viz';root.dataset.testid='decision-visualizations';
  const stylesheet=doc.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./visualization.css',import.meta.url).href;root.append(stylesheet);
  const content=doc.createElement('div');root.append(content);container.append(root);
  content.innerHTML=`<div class="dv-panel"><div class="dv-heading"><div><h2>Explore possible futures</h2><p class="dv-muted">Every point is one completed simulation. Select a future to inspect its path.</p></div><strong data-summary role="status" aria-live="polite">Waiting for results</strong></div><div class="dv-empty" data-empty>Run an experiment to see its outcome landscape and uncertainty.</div><div data-results hidden><div class="dv-controls"><label>X axis <select data-control="x" aria-label="Landscape X axis"></select></label><label>Y axis <select data-control="y" aria-label="Landscape Y axis"></select></label><label>Depth <select data-control="z" aria-label="Landscape depth axis"></select></label><label>Scenario <select data-control="scenario" aria-label="Filter scenario"></select></label><button data-control="projection" aria-pressed="false">3D projection</button><label data-rotation hidden>Rotate <input data-control="rotation" type="range" min="-180" max="180" value="25" aria-label="Rotate landscape"></label><label><input data-control="unfavorable" type="checkbox">Unfavorable matched futures</label></div><p class="dv-muted" data-filter-note></p><div class="dv-legend" data-legend></div><svg data-viz="landscape" class="dv-chart" viewBox="0 0 760 370" role="img" aria-label="Outcome landscape"></svg><div class="dv-tooltip" data-tooltip role="status" aria-live="polite">Hover or focus a future for its seed and metrics.</div><details><summary>Browse 100 or 500 futures at a time</summary><div data-viz="worlds" class="dv-worlds" aria-label="100 futures"></div><div class="dv-row"><button data-control="page-prev">Previous 100</button><span data-page></span><button data-control="page-next">Next 100</button></div></details></div></div><div data-detail hidden><div class="dv-grid"><section class="dv-panel" data-viz="distribution"><h3>Outcome distributions</h3><label>Metric <select data-control="metric" aria-label="Distribution metric"></select></label><div data-distributions></div><p class="dv-muted">Intervals contain the middle 80% of simulated outcomes (p10–p90), not confidence intervals or forecast guarantees.</p></section><section class="dv-panel" data-viz="pareto"><h3>Cost and affordability tradeoff</h3><p class="dv-muted" data-pareto-note></p><svg class="dv-chart" viewBox="0 0 600 340" aria-label="Cost versus affordability Pareto view" role="img"></svg><p class="dv-muted">Outlined points form the nondominated frontier: improving one objective requires giving up another within the displayed runs.</p></section></div><section class="dv-panel" data-viz="comparison"><h3>Compare scenarios</h3><p class="dv-muted">Paired improvement probabilities come from successful runs with matching seeds. Values summarize simulations completed so far.</p><div class="dv-table-wrap" data-comparison></div></section><section class="dv-panel" data-viz="replay"><h3>Replay a selected future</h3><p data-run-summary class="dv-run-summary">Select a point or one of the 100 futures.</p><div data-replay-body hidden><div class="dv-controls dv-transport"><button data-control="replay-start" aria-label="Replay from first year">|◀</button><button data-control="replay-play" aria-label="Play future replay">Play</button><label>Year <output data-replay-year></output></label><input class="dv-replay-slider" data-control="replay-year" type="range" min="0" step="1" value="0" aria-label="Replay year"></div><svg class="dv-chart" data-replay-chart viewBox="0 0 760 270" role="img" aria-label="Selected future metric timeline"></svg><div data-building-replay></div><div class="dv-stats" data-replay-metrics></div><h3>Events during this year</h3><ul class="dv-events" data-replay-events></ul><details><summary>Sampled input parameters</summary><div class="dv-table-wrap" data-run-parameters></div></details></div></section></div>`;
  const exploration=doc.createElement('div');exploration.className='dv-exploration';exploration.innerHTML=`<div class="dv-controls"><label>Color <select data-control="color"><option value="scenario">Scenario</option><option value="outcome">Success / mixed / failure</option></select></label><label>Outcome <select data-control="outcome"><option value="">All outcomes</option><option value="success">Success</option><option value="mixed">Mixed</option><option value="unclassified">Unclassified</option><option value="failure">Failure</option></select></label><label>Find futures <input data-control="search" type="search" maxlength="300" placeholder="rent below 2000 and cost < 2b" aria-label="Search future metrics and events"></label><label><input type="checkbox" data-control="density">Density contours</label><label><input type="checkbox" data-control="ghost" checked>Previous experiment</label><button data-control="lasso" aria-pressed="false">Lasso futures</button><button data-control="clear-lasso">Clear selection</button></div><p class="dv-muted" data-search-note>Search is a bounded local metric/event filter, not AI interpretation. No recorded criteria means unclassified.</p><div class="dv-stats" data-paired-strip></div><p role="status" data-lasso-support></p>`;content.querySelector('[data-viz="landscape"]').before(exploration);
  const shortcuts=doc.createElement('div');shortcuts.className='dv-controls';shortcuts.innerHTML='<button data-control="best">Best future</button><button data-control="median">Median future</button><button data-control="worst">Worst future</button><button data-control="enter" disabled>Enter future ↗</button><span data-median-compare></span>';content.querySelector('[data-run-summary]').after(shortcuts);
  const gridControl=doc.createElement('label');gridControl.className='dv-grid-control';gridControl.innerHTML='Futures per page <select data-control="grid-size"><option value="100">100</option><option value="500">500</option></select>';content.querySelector('[data-viz="worlds"]').before(gridControl);
  const $=s=>root.querySelector(s), control=name=>$(`[data-control="${name}"]`);
  let state={experiment:null,runs:[],aggregates:[],comparisons:[],model:{}}, runs=[],metrics=[],scenarios=[],selected=null,page=0,replayIndex=0,timer=null,destroyed=false,threeD=false;
  let xKey='',yKey='',zKey='',metricKey='',scenarioFilter='',unfavorable=false;
  let baselineSeeds=new Map();
  let buildingReplay=null,buildingLoading=false;
  let outcomeFilter='',colorMode='scenario',searchQuery='',search={test:()=>true},gridSize=doc.defaultView.matchMedia?.('(max-width: 640px)').matches?500:100,showGhost=true,showDensity=false,lassoMode=false,lassoIds=new Set(),lassoPoints=[],projectedPoints=[],lassoPath=null;
  control('grid-size').value=String(gridSize);if(gridSize===500)content.querySelector('[data-viz="worlds"]').closest('details').open=true;
  const cleanups=[];
  const listen=(element,event,handler)=>{element.addEventListener(event,handler);cleanups.push(()=>element.removeEventListener(event,handler))};
  const meta=id=>metrics.find(m=>m.id===id)||{id,label:titleCase(id)};
  const name=id=>scenarios.find(s=>s.id===id)?.name||id;
  const color=id=>COLORS[Math.max(0,scenarios.findIndex(s=>s.id===id))%COLORS.length];
  const format=(value,id)=>{
    if(!finite(value))return '—';
    const unit=meta(id).unit;
    const options={maximumFractionDigits:2};
    if(['fraction','probability','ratio_fraction'].includes(unit))Object.assign(options,{style:'percent'});
    if(Math.abs(value)>=1e6)Object.assign(options,{notation:'compact',maximumFractionDigits:2});
    const text=new Intl.NumberFormat(undefined,options).format(value);
    return /^(USD|usd|currency|dollars)(\/|$)/.test(unit||'')?`$${text}`: unit==='percent'||unit==='%'?`${text}%`:text;
  };
  const svgNode=(svg,tag,attrs={},text)=>{const el=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=text;svg.append(el);return el};
  const el=(tag,text,className)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e};
  const stop=()=>{if(timer!==null)clearInterval(timer);timer=null;control('replay-play').textContent='Play';control('replay-play').setAttribute('aria-label','Play future replay')};
  function baselineFor(run){return baselineSeeds.get(run.seed)}
  function isUnfavorable(run){const base=baselineFor(run),a=run.metrics[yKey],b=base?.metrics[yKey];return base&&base.scenarioId!==run.scenarioId&&finite(a)&&finite(b)&&(['lower-is-better','lower','minimize'].includes(meta(yKey).direction)?a>b:a<b)}
  const scenarioFor=r=>state.experiment?.scenarios?.find(s=>s.id===r.scenarioId)||{};
  const outcomeColors={success:'#087f64',mixed:'#b47b19',failure:'#c04f65',unclassified:'#71828a'};
  const runColor=r=>colorMode==='outcome'?outcomeColors[futureOutcome(r,scenarioFor(r))]:color(r.scenarioId);
  const visible=()=>runs.filter(r=>(!scenarioFilter||r.scenarioId===scenarioFilter)&&(!unfavorable||isUnfavorable(r))&&(!outcomeFilter||futureOutcome(r,scenarioFor(r))===outcomeFilter)&&search.test(r,scenarioFor(r))); 
  function tooltip(run){$('[data-tooltip]').textContent=`${name(run.scenarioId)} · Seed ${run.seed} · ${meta(xKey).label}: ${format(run.metrics[xKey],xKey)} · ${meta(yKey).label}: ${format(run.metrics[yKey],yKey)} · Outcome ${futureOutcome(run,scenarioFor(run))} · Future ${run.id}`}
  function choose(run){stop();selected=run;replayIndex=0;tooltip(run);renderLandscape();renderWorlds();renderReplay();renderExploration();if(typeof onSelectRun==='function')onSelectRun(run)}
  function optionList(select,items,value){select.replaceChildren(...items.map(item=>{const o=el('option',item.label);o.value=item.id;return o}));select.value=value}
  function drawScatter(svg,rows,xId,yId,{depth=false,front=[]}={}){
    svg.replaceChildren();const width=svg=== $('[data-viz="landscape"]')?760:600,height=svg===$('[data-viz="landscape"]')?370:340;
    const valid=rows.filter(r=>finite(r.metrics[xId])&&finite(r.metrics[yId]));
    svgNode(svg,'title',{},`${meta(xId).label} versus ${meta(yId).label}`);
    if(!valid.length){svgNode(svg,'text',{x:width/2,y:height/2,'text-anchor':'middle',fill:'#566f73'},'No completed futures match these filters');return}
    const domain=id=>{const v=[...valid,...((showGhost&&svg===$('[data-viz="landscape"]'))?(state.previousResults?.runs||[]).filter(success):[])].map(r=>r.metrics[id]).filter(finite);let lo=Math.min(...v),hi=Math.max(...v);if(!v.length)return[0,1];const pad=(hi-lo)*.07||Math.max(1,Math.abs(lo)*.05);return[lo-pad,hi+pad]};
    const [xmin,xmax]=domain(xId),[ymin,ymax]=domain(yId),[zmin,zmax]=domain(zKey);
    const norm=(v,lo,hi)=>(v-lo)/(hi-lo);
    const angle=Number(control('rotation').value)*Math.PI/180;
    const project=r=>{const x=norm(r.metrics[xId],xmin,xmax),y=norm(r.metrics[yId],ymin,ymax),z=finite(r.metrics[zKey])?norm(r.metrics[zKey],zmin,zmax):.5;if(!depth)return[75+x*(width-100),height-58-y*(height-90),0];const a=(x-.5)*Math.cos(angle)+(z-.5)*Math.sin(angle),d=-(x-.5)*Math.sin(angle)+(z-.5)*Math.cos(angle);return[width/2+a*(width-160)*.72,height*.49-(y-.5)*(height-110)*.85+d*50,d]};
    for(let i=0;i<=4;i++){const py=height-58-i*(height-90)/4;svgNode(svg,'line',{x1:75,x2:width-25,y1:py,y2:py,stroke:'#e0eae7'});if(!depth){svgNode(svg,'text',{x:65,y:py+4,'text-anchor':'end','font-size':11,fill:'#566f73'},format(ymin+(ymax-ymin)*i/4,yId));svgNode(svg,'text',{x:75+i*(width-100)/4,y:height-36,'text-anchor':'middle','font-size':11,fill:'#566f73'},format(xmin+(xmax-xmin)*i/4,xId))}}
    svgNode(svg,'text',{x:width/2,y:height-10,'text-anchor':'middle','font-size':12,fill:'#173b40'},meta(xId).label+(depth?' · rotated projection':''));
    svgNode(svg,'text',{x:14,y:height/2,transform:`rotate(-90 14 ${height/2})`,'text-anchor':'middle','font-size':12,fill:'#173b40'},meta(yId).label);
    if(svg===$('[data-viz="landscape"]')){
      projectedPoints=valid.map(r=>{const p=project(r);return {x:p[0],y:p[1],run:r}});
      if(showGhost)for(const r of stratifiedScenarioSample((state.previousResults?.runs||[]).filter(success).filter(r=>finite(r.metrics[xId])&&finite(r.metrics[yId])&&(!scenarioFilter||r.scenarioId===scenarioFilter)),600)){const p=project(r);svgNode(svg,'circle',{cx:p[0],cy:p[1],r:3.5,fill:'none',stroke:'#768a90',opacity:.35,'data-ghost-run':r.id})}
      if(showDensity&&!depth){const density=densityContours(valid.map(r=>({x:norm(r.metrics[xId],xmin,xmax),y:norm(r.metrics[yId],ymin,ymax)})));for(const level of density.levels){const d=level.segments.map(([a,b])=>`M${75+a[0]*(width-100)},${height-58-a[1]*(height-90)}L${75+b[0]*(width-100)},${height-58-b[1]*(height-90)}`).join(' ');svgNode(svg,'path',{d,fill:'none',stroke:'#456c75','stroke-width':1.4,opacity:.5,'data-density-support':density.support})}}
    }
    const frontier=new Set(front.map(r=>r.id));
    if(front.length>1)svgNode(svg,'path',{d:front.map((r,i)=>`${i?'L':'M'}${project(r)[0]},${project(r)[1]}`).join(' '),fill:'none',stroke:'#173b40','stroke-width':1.5,'stroke-dasharray':'4 4'});
    // SVG point budget is bounded; every run remains accessible in paged worlds.
    const sampled=stratifiedScenarioSample(valid,1200);
    const included=new Set(sampled.map(r=>r.id));
    for(const row of valid)if((row.id===selected?.id||frontier.has(row.id))&&!included.has(row.id)){sampled.push(row);included.add(row.id)}
    const points=sampled.map(r=>({r,p:project(r)})).sort((a,b)=>a.p[2]-b.p[2]);
    for(const {r,p}of points){const active=r.id===selected?.id;const dot=svgNode(svg,'circle',{cx:p[0],cy:p[1],r:active?7:frontier.has(r.id)?5.5:depth?3.5+(p[2]+.7)*2:4.2,fill:runColor(r),opacity:active?1:.65,stroke:active||frontier.has(r.id)||lassoIds.has(r.id)?'#173b40':'white','stroke-width':active?2.5:1,'data-run-id':r.id,tabindex:0,role:'button','aria-label':`${name(r.scenarioId)}, seed ${r.seed}, ${meta(xId).label} ${format(r.metrics[xId],xId)}, ${meta(yId).label} ${format(r.metrics[yId],yId)}`});svgNode(dot,'title',{},`${name(r.scenarioId)} · Seed ${r.seed}\n${meta(xId).label}: ${format(r.metrics[xId],xId)}\n${meta(yId).label}: ${format(r.metrics[yId],yId)}`)}
  }
  function renderLandscape(){drawScatter($('[data-viz="landscape"]'),visible(),xKey,yKey,{depth:threeD});renderExploration();$('[data-filter-note]').textContent=`${visible().length.toLocaleString()} matching futures. ${unfavorable?`Unfavorable means worse ${meta(yKey).label.toLowerCase()} than the baseline with the same seed.`:`Axes reflect final-year outcomes; colors identify ${colorMode==='outcome'?'recorded success criteria':'scenarios'}.`}${runs.length>1200?' Landscape shows a bounded sample; browse every run in the 100-futures view.':''}`}
  function renderWorlds(){const rows=visible();page=Math.max(0,Math.min(page,Math.ceil(rows.length/gridSize)-1));const grid=$('[data-viz="worlds"]');grid.classList.toggle('dv-worlds-500',gridSize===500);grid.setAttribute('aria-label',`${gridSize} futures per page`);grid.replaceChildren();for(const run of rows.slice(page*gridSize,page*gridSize+gridSize)){const b=el('button','','dv-world');b.type='button';b.classList.toggle('dv-lasso-member',lassoIds.has(run.id));b.style.background=runColor(run);b.dataset.outcome=futureOutcome(run,scenarioFor(run));b.dataset.runId=run.id;b.setAttribute('aria-pressed',String(run.id===selected?.id));b.setAttribute('aria-label',`${name(run.scenarioId)}, seed ${run.seed}, ${meta(yKey).label} ${format(run.metrics[yKey],yKey)}, ${futureOutcome(run,scenarioFor(run))}`);b.title=`${name(run.scenarioId)} · Seed ${run.seed} · ${meta(yKey).label}: ${format(run.metrics[yKey],yKey)}`;grid.append(b)}$('[data-page]').textContent=rows.length?`${page*gridSize+1}–${Math.min(rows.length,(page+1)*gridSize)} of ${rows.length}`:'No matching futures';control('page-prev').disabled=page===0;control('page-next').disabled=(page+1)*gridSize>=rows.length}
  function renderDistributions(){const box=$('[data-distributions]');box.replaceChildren();const values=runs.map(r=>r.metrics[metricKey]).filter(finite);if(!values.length){box.append(el('p','No values for this metric yet.'));return}const domain=[Math.min(...values),Math.max(...values)];for(const scenario of scenarios){const rows=runs.filter(r=>r.scenarioId===scenario.id),data=rows.map(r=>r.metrics[metricKey]).filter(finite);if(!data.length)continue;const card=el('div');card.append(el('h4',`${scenario.name} · ${data.length} futures`));const chart=doc.createElementNS('http://www.w3.org/2000/svg','svg');chart.setAttribute('viewBox','0 0 450 110');chart.classList.add('dv-chart');chart.setAttribute('role','img');chart.setAttribute('aria-label',`${scenario.name} ${meta(metricKey).label} distribution`);const bins=histogram(data,18,domain),max=Math.max(...bins.map(b=>b.count),1);for(const [i,bin]of bins.entries()){const bar=svgNode(chart,'rect',{x:40+i*21,y:75-bin.count/max*60,width:19,height:bin.count/max*60,fill:color(scenario.id),opacity:.8});svgNode(bar,'title',{},`${format(bin.min,metricKey)}–${format(bin.max,metricKey)}: ${bin.count} futures`)}svgNode(chart,'text',{x:40,y:99,'font-size':11,fill:'#566f73'},format(bins[0].min,metricKey));svgNode(chart,'text',{x:418,y:99,'text-anchor':'end','font-size':11,fill:'#566f73'},format(bins.at(-1).max,metricKey));card.append(chart);const stats=el('div',undefined,'dv-stats');for(const [label,value]of [['Median',format(quantile(data,.5),metricKey)],['Mean',format(data.reduce((a,b)=>a+b,0)/data.length,metricKey)],['80% interval',`${format(quantile(data,.1),metricKey)} – ${format(quantile(data,.9),metricKey)}`]]){const s=el('div',label,'dv-stat');s.append(el('strong',value));stats.append(s)}card.append(stats);box.append(card)}}
  function renderComparison(){const wrap=$('[data-comparison]');wrap.replaceChildren();const table=el('table'),head=el('thead'),tr=el('tr');tr.append(el('th','Metric'));for(const s of scenarios)tr.append(el('th',s.name));head.append(tr);table.append(head);const body=el('tbody');for(const m of metrics){const row=el('tr');row.append(el('th',m.label));for(const scenario of scenarios){const data=runs.filter(r=>r.scenarioId===scenario.id).map(r=>r.metrics[m.id]).filter(finite),cell=el('td');if(!data.length)cell.textContent='—';else{cell.append(el('div',format(quantile(data,.5),m.id)));cell.append(el('small',`p10–p90: ${format(quantile(data,.1),m.id)} – ${format(quantile(data,.9),m.id)}`));const comparison=state.comparisons?.find(c=>c.scenarioId===scenario.id)?.metrics?.[m.id];if(finite(comparison?.probabilityImprovement))cell.append(el('div',`${new Intl.NumberFormat(undefined,{style:'percent',maximumFractionDigits:1}).format(comparison.probabilityImprovement)} improve vs baseline`))}row.append(cell)}body.append(row)}table.append(body);wrap.append(table)}
  function renderPareto(){const cost=metrics.find(m=>/public_expenditure|public_cost|government_cost|fiscal_cost|total_cost|expenditure/.test(m.id))||metrics.find(m=>/cost/.test(m.id));const affordability=metrics.find(m=>/affordability/.test(m.id))||metrics.find(m=>/rent/.test(m.id));const chart=$('[data-viz="pareto"] svg');if(!cost||!affordability){chart.replaceChildren();$('[data-pareto-note]').textContent='Cost and affordability metrics will appear when the model provides them.';return}const rows=visible(),front=paretoFront(rows,cost.id,affordability.id,'lower-is-better',affordability.direction);$('[data-pareto-note]').textContent=`${cost.label} (lower preferred) versus ${affordability.label} (${['lower-is-better','lower','minimize'].includes(affordability.direction)?'lower':'higher'} preferred). ${front.length} nondominated futures in the current filter.`;drawScatter(chart,rows,cost.id,affordability.id,{front})}
  function replayRows(){return (Array.isArray(selected?.monthlyTimeline)?selected.monthlyTimeline:Array.isArray(selected?.timeline)?selected.timeline:[]).map(r=>finite(r?.year)?r:finite(r?.month)?{...r,year:r.month/12}:r).filter(r=>finite(r?.year)&&r.metrics).sort((a,b)=>a.year-b.year)}
  function renderReplay(){
    const projectRows=selected?.projects||[];
    const projects=state.experiment?.scenarios?.find(s=>s.id===selected?.scenarioId)?.projects||projectRows.map(p=>p.proposal).filter(Boolean);
    const host=$('[data-building-replay]');
    if(projects.length&&selected){
      const month=Math.round((replayRows()[replayIndex]?.year||0)*12);
      if(buildingReplay)buildingReplay.update({projects,run:selected,month,worldVisuals:state.experiment?.scenarios?.find(s=>s.id===selected.scenarioId)?.worldVisuals||{}});
      else if(!buildingLoading){buildingLoading=true;import('../buildings/renderer.js').then(({mountBuildingWorld})=>{if(destroyed)return;buildingReplay=mountBuildingWorld(host,{projects,run:selected,month});renderReplay()}).catch(error=>{if(!destroyed)host.textContent=`Construction view unavailable: ${error.message}`}).finally(()=>{buildingLoading=false})}
    }else if(buildingReplay){buildingReplay.destroy();buildingReplay=null}
    const summary=$('[data-run-summary]'),body=$('[data-replay-body]');if(!selected){body.hidden=true;summary.textContent='Select a point or one of the 100 futures.';return}const rows=replayRows();summary.textContent=`${name(selected.scenarioId)} · Future ${selected.id} · Seed ${selected.seed} · Model ${selected.modelVersion||state.model?.version||'unspecified'}${rows.length&&!rows.some(r=>r.year===0)?' · Year 0 was not recorded by this model.':''}`;body.hidden=!rows.length;if(!rows.length){summary.textContent+=' · No yearly timeline is available.';return}replayIndex=Math.max(0,Math.min(replayIndex,rows.length-1));const row=rows[replayIndex];control('replay-year').max=String(rows.length-1);control('replay-year').value=String(replayIndex);control('replay-year').disabled=rows.length<2;control('replay-year').setAttribute('aria-valuetext',`Year ${row.year}`);control('replay-play').disabled=rows.length<2;$('[data-replay-year]').textContent=Number(row.year.toFixed(3)).toString();control('replay-year').setAttribute('aria-valuetext',`Month ${Math.round(row.year*12)}, year ${Number(row.year.toFixed(3))}`);
    const chart=$('[data-replay-chart]');chart.replaceChildren();const data=rows.map(r=>r.metrics[metricKey]).filter(finite);svgNode(chart,'title',{},`${meta(metricKey).label}, selected future, year ${row.year}`);if(data.length){let lo=Math.min(...data),hi=Math.max(...data);const pad=(hi-lo)*.1||Math.max(1,Math.abs(lo)*.05);lo-=pad;hi+=pad;const x=y=>70+(y-rows[0].year)/(rows.at(-1).year-rows[0].year||1)*660,y=v=>220-(v-lo)/(hi-lo)*195;for(let i=0;i<4;i++){const v=lo+(hi-lo)*i/3;svgNode(chart,'line',{x1:70,x2:730,y1:y(v),y2:y(v),stroke:'#d7e5e4'});svgNode(chart,'text',{x:60,y:y(v)+4,'text-anchor':'end','font-size':11,fill:'#566f73'},format(v,metricKey))}let path='',open=false;for(const r of rows){const v=r.metrics[metricKey];if(!finite(v)){open=false;continue}path+=`${open?'L':'M'}${x(r.year)},${y(v)} `;open=true}svgNode(chart,'path',{d:path,stroke:color(selected.scenarioId),'stroke-width':3,fill:'none'});svgNode(chart,'line',{x1:x(row.year),x2:x(row.year),y1:20,y2:220,stroke:'#173b40','stroke-dasharray':'4 4'});if(finite(row.metrics[metricKey]))svgNode(chart,'circle',{cx:x(row.year),cy:y(row.metrics[metricKey]),r:6,fill:color(selected.scenarioId),stroke:'white','stroke-width':2});for(const event of (selected.events||[]).filter(e=>finite(e.year)&&e.year>=rows[0].year&&e.year<=rows.at(-1).year).slice(0,180)){const marker=svgNode(chart,'circle',{cx:x(event.year),cy:222,r:3.5,fill:'#b96928',tabindex:0,role:'button','data-event-year':event.year,'aria-label':`${event.label||event.type||'Event'}, month ${Math.round(event.year*12)}`});svgNode(marker,'title',{},`${event.label||event.type} · Month ${Math.round(event.year*12)}`)} for(const yr of [...new Set([rows[0].year,row.year,rows.at(-1).year])])svgNode(chart,'text',{x:x(yr),y:244,'text-anchor':'middle','font-size':12,fill:'#566f73'},`Year ${yr}`);svgNode(chart,'text',{x:400,y:266,'text-anchor':'middle','font-size':12,fill:'#173b40'},meta(metricKey).label)}
    const cards=$('[data-replay-metrics]');cards.replaceChildren();for(const metric of metrics){if(!finite(row.metrics[metric.id]))continue;const card=el('div',metric.label,'dv-stat');card.append(el('strong',format(row.metrics[metric.id],metric.id)));cards.append(card)}
    const events=$('[data-replay-events]');events.replaceChildren();const recorded=[...(selected.events||[]).filter(e=>finite(e?.year)&&e.year<=(row.year)&&e.year>(rows[replayIndex-1]?.year??-Infinity)),...(row.events||[])];const eventTexts=[...new Set(recorded.map(e=>typeof e==='string'?e:e.description||e.message||e.label||e.type||JSON.stringify(e)))];for(const text of eventTexts)events.append(el('li',text));if(!recorded.length)events.append(el('li','No events recorded for this year.'));
    const params=$('[data-run-parameters]');params.replaceChildren();const table=el('table');for(const [key,value]of Object.entries(selected.sampledParameters||selected.parameters||{})){const tr=el('tr');tr.append(el('th',state.model?.parameters?.find(p=>p.id===key)?.label||titleCase(key)),el('td',typeof value==='object'?JSON.stringify(value):String(value)));table.append(tr)}params.append(table);
  }
  function renderExploration(){
    $('[data-search-note]').textContent=search.error||`${search.description||'All futures'}. Comparisons support “and”; plain phrases search recorded events. Missing success criteria are unclassified.${showDensity&&threeD?' Density contours are shown only in the 2D view.':''}`;
    $('[data-lasso-support]').textContent=lassoIds.size?`${visible().filter(r=>lassoIds.has(r.id)).length} selected of ${visible().length} filtered futures (${runs.length} completed overall). Support is a descriptive count, not causal evidence.`:'Draw a lasso in the landscape to count a group of actual futures.';
    const strip=$('[data-paired-strip]');strip.replaceChildren();const prior=(state.previousResults?.runs||[]).filter(success);
    if(prior.length){
      const previous=state.previousResults?.experiment,current=state.experiment;
      const compatible=['modelId','modelVersion','years'].every(key=>previous?.[key]!==undefined&&current?.[key]!==undefined&&previous[key]===current[key]);
      if(!compatible){strip.append(el('p','Previous cloud is shown for inspection only: model ID, version, or horizon differs or is unverified. Paired changes are withheld.','dv-muted'));}
      else {
        const groups=scenarios.filter(s=>visible().some(r=>r.scenarioId===s.id));
        const total=pairedMetricDeltas(visible(),prior,yKey).count;
        strip.append(el('p',`${total} matched pairs across ${groups.length} scenarios. Summaries remain separate; changed and unchanged alternatives are not pooled. These are paired simulation differences, not empirical causal estimates.`,'dv-pair-note'));
        for(const scenario of groups)for(const id of [...new Set([xKey,yKey])]){const d=pairedMetricDeltas(visible().filter(r=>r.scenarioId===scenario.id),prior,id),card=el('div',`${scenario.name} · ${meta(id).label} · ${d.count} matched pairs`,'dv-stat');card.dataset.pairedScenario=scenario.id;card.append(el('strong',`${format(d.before,id)} → ${format(d.after,id)}`),el('small',`Median paired change: ${d.medianDelta>0?'+':''}${format(d.medianDelta,id)}`));strip.append(card)}
      }
    }
    if(colorMode==='outcome'){const legend=$('[data-legend]');legend.replaceChildren();for(const outcome of ['success','mixed','failure','unclassified']){const item=el('span'),swatch=el('i',undefined,'dv-swatch');swatch.style.background=outcomeColors[outcome];item.append(swatch,doc.createTextNode(`${titleCase(outcome)} (${runs.filter(r=>futureOutcome(r,scenarioFor(r))===outcome).length})`));legend.append(item)}}
    control('enter').disabled=!selected;
    if(selected){const data=runs.filter(r=>r.scenarioId===selected.scenarioId).map(r=>r.metrics[metricKey]).filter(finite),median=quantile(data,.5),value=selected.metrics[metricKey];$('[data-median-compare]').textContent=`${meta(metricKey).label}: selected ${format(value,metricKey)} · scenario median ${format(median,metricKey)} · difference ${finite(value)&&finite(median)?format(value-median,metricKey):'—'}`}
    for(const key of ['best','median','worst'])control(key).disabled=!runs.some(r=>finite(r.metrics[metricKey]));
    control('page-prev').textContent=`Previous ${gridSize}`;control('page-next').textContent=`Next ${gridSize}`;
  }
  function chooseRank(rank){const data=visible().filter(r=>finite(r.metrics[metricKey])).sort((a,b)=>a.metrics[metricKey]-b.metrics[metricKey]);if(!data.length)return;const lower=['lower','lower-is-better','minimize'].includes(meta(metricKey).direction);const index=rank==='median'?Math.floor((data.length-1)/2):rank==='best'?(lower?0:data.length-1):(lower?data.length-1:0);choose(data[index]);renderExploration()}
  const filteredRefresh=()=>{page=0;lassoIds.clear();renderLandscape();renderWorlds();renderPareto()};
  listen(control('color'),'change',()=>{colorMode=control('color').value;renderAll()});
  listen(control('outcome'),'change',()=>{outcomeFilter=control('outcome').value;filteredRefresh()});
  listen(control('search'),'input',()=>{searchQuery=control('search').value;search=compileFutureSearch(searchQuery,metrics);filteredRefresh()});
  listen(control('density'),'change',()=>{showDensity=control('density').checked;renderLandscape()});
  listen(control('ghost'),'change',()=>{showGhost=control('ghost').checked;renderLandscape()});
  listen(control('grid-size'),'change',()=>{gridSize=Number(control('grid-size').value);page=0;renderWorlds();renderExploration()});
  for(const rank of ['best','median','worst'])listen(control(rank),'click',()=>chooseRank(rank));
  listen(control('enter'),'click',()=>{if(!selected)return;root.classList.add('dv-entering');const month=Math.round((replayRows()[replayIndex]?.year||0)*12);if(onEnterFuture){onEnterFuture(selected,{month,url:futureWorldURL(state.experiment,selected,month)});root.classList.remove('dv-entering');}else if(state.experiment?.id)doc.defaultView.location.assign(futureWorldURL(state.experiment,selected,month))});
  listen(control('lasso'),'click',()=>{lassoMode=!lassoMode;control('lasso').setAttribute('aria-pressed',String(lassoMode));$('[data-viz="landscape"]').classList.toggle('dv-lasso-active',lassoMode)});
  listen(control('clear-lasso'),'click',()=>{lassoIds.clear();renderLandscape()});
  const landscape=$('[data-viz="landscape"]');
  const svgPoint=event=>{const rect=landscape.getBoundingClientRect();return [(event.clientX-rect.left)/rect.width*760,(event.clientY-rect.top)/rect.height*370]};
  listen(landscape,'pointerdown',event=>{if(!lassoMode)return;event.preventDefault();lassoPoints=[svgPoint(event)];landscape.setPointerCapture?.(event.pointerId);lassoPath=svgNode(landscape,'path',{fill:'#087f7e22',stroke:'#087f7e','stroke-width':2,'pointer-events':'none'})});
  listen(landscape,'pointermove',event=>{if(!lassoMode||!lassoPath)return;const point=svgPoint(event),last=lassoPoints.at(-1);if(Math.hypot(point[0]-last[0],point[1]-last[1])<3)return;lassoPoints.push(point);lassoPath.setAttribute('d',lassoPoints.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join(' ')+'Z')});
  listen(landscape,'pointerup',event=>{if(!lassoPath)return;lassoPoints.push(svgPoint(event));lassoIds=new Set(pointsInPolygon(projectedPoints,lassoPoints).map(p=>p.run.id));lassoPath=null;renderLandscape();renderWorlds()});
  function renderAll(){if(destroyed)return;const has=runs.length>0;$('[data-empty]').hidden=has;$('[data-results]').hidden=!has;$('[data-detail]').hidden=!has;$('[data-summary]').textContent=`${runs.length.toLocaleString()} completed futures${state.experiment?.status==='running'?' · updating':''}`;if(!has)return;const legend=$('[data-legend]');legend.replaceChildren();for(const s of scenarios){const item=el('span'),swatch=el('i',undefined,'dv-swatch');swatch.style.background=color(s.id);item.append(swatch,doc.createTextNode(s.name));legend.append(item)}renderLandscape();renderWorlds();renderDistributions();renderComparison();renderPareto();renderReplay()}
  for(const key of ['x','y','z'])listen(control(key),'change',()=>{if(key==='x')xKey=control(key).value;if(key==='y')yKey=control(key).value;if(key==='z')zKey=control(key).value;page=0;renderLandscape();renderWorlds()});
  listen(control('metric'),'change',()=>{metricKey=control('metric').value;renderDistributions();renderReplay();renderExploration()});
  listen(control('scenario'),'change',()=>{scenarioFilter=control('scenario').value;page=0;renderLandscape();renderWorlds();renderPareto()});
  listen(control('unfavorable'),'change',()=>{unfavorable=control('unfavorable').checked;page=0;renderLandscape();renderWorlds();renderPareto()});
  listen(control('projection'),'click',()=>{threeD=!threeD;control('projection').setAttribute('aria-pressed',String(threeD));$('[data-rotation]').hidden=!threeD;renderLandscape()});
  listen(control('rotation'),'input',renderLandscape);
  listen(control('page-prev'),'click',()=>{page--;renderWorlds()});listen(control('page-next'),'click',()=>{page++;renderWorlds()});
  listen(root,'click',event=>{const point=event.target.closest('[data-run-id]');if(point&&!lassoMode){const run=runs.find(r=>r.id===point.dataset.runId);if(run)choose(run)}});
  listen(root,'keydown',event=>{const point=event.target.closest('circle[data-run-id]');if(point&&['Enter',' '].includes(event.key)){event.preventDefault();const run=runs.find(r=>r.id===point.dataset.runId);if(run)choose(run)}});
  for(const type of ['pointerover','focusin'])listen(root,type,event=>{const point=event.target.closest('[data-run-id]');if(point){const run=runs.find(r=>r.id===point.dataset.runId);if(run)tooltip(run)}});
  listen(control('replay-year'),'input',()=>{stop();replayIndex=Number(control('replay-year').value);renderReplay()});
  const selectEvent=target=>{const event=target.closest('[data-event-year]');if(!event)return false;stop();const year=Number(event.dataset.eventYear),rows=replayRows();replayIndex=Math.max(0,rows.findLastIndex(r=>r.year<=year));renderReplay();return true};
  listen(root,'click',event=>selectEvent(event.target));listen(root,'keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.matches('[data-event-year]')){event.preventDefault();selectEvent(event.target)}});
  listen(control('replay-start'),'click',()=>{stop();replayIndex=0;renderReplay()});
  listen(control('replay-play'),'click',()=>{if(timer!==null)return stop();const rows=replayRows();if(rows.length<2)return;if(replayIndex>=rows.length-1)replayIndex=0;control('replay-play').textContent='Pause';control('replay-play').setAttribute('aria-label','Pause future replay');renderReplay();timer=setInterval(()=>{replayIndex++;renderReplay();if(replayIndex>=replayRows().length-1)stop()},700)});
  return {
    update(next={}){
      if(destroyed)return;const prior=state.experiment?.id;state={...next};runs=(Array.isArray(next.runs)?next.runs:[]).filter(success);metrics=(Array.isArray(next.model?.metrics)?next.model.metrics:[]).map(m=>({...m,label:m.label||titleCase(m.id)}));
      const baselineId=next.experiment?.scenarios?.find(s=>s.kind==='baseline')?.id;
      baselineSeeds=new Map(runs.filter(r=>r.scenarioId===baselineId).map(r=>[r.seed,r]));
      const ids=[...new Set(runs.flatMap(r=>Object.keys(r.metrics).filter(key=>finite(r.metrics[key]))))];if(!metrics.length)metrics=ids.map(id=>({id,label:titleCase(id)}));
      scenarios=(next.experiment?.scenarios||[]).map(s=>({...s,id:s.id,name:s.name||s.id,kind:s.kind}));for(const id of new Set(runs.map(r=>r.scenarioId)))if(!scenarios.some(s=>s.id===id))scenarios.push({id,name:id});
      const defaultCost=metrics.find(m=>/expenditure|public_cost|government_cost/.test(m.id))?.id;const defaultOutcome=metrics.find(m=>/affordability/.test(m.id))?.id;
      if(!metrics.some(m=>m.id===xKey))xKey=defaultCost||metrics[0]?.id||'';if(!metrics.some(m=>m.id===yKey))yKey=defaultOutcome||metrics[1]?.id||xKey;if(!metrics.some(m=>m.id===zKey))zKey=metrics.find(m=>/supply|housing_stock|housing_units/.test(m.id))?.id||metrics[2]?.id||yKey;if(!metrics.some(m=>m.id===metricKey))metricKey=yKey;
      for(const key of ['x','y','z','metric'])optionList(control(key),metrics,key==='x'?xKey:key==='y'?yKey:key==='z'?zKey:metricKey);
      if(!scenarios.some(s=>s.id===scenarioFilter))scenarioFilter='';optionList(control('scenario'),[{id:'',label:'All scenarios'},...scenarios.map(s=>({id:s.id,label:s.name}))],scenarioFilter);
      if(prior!==next.experiment?.id){stop();page=0;selected=null;replayIndex=0}if(next.selectedRun)selected=runs.find(r=>r.id===next.selectedRun.id)||selected;
      const query=new URLSearchParams(doc.defaultView.location?.search||'');if(!selected&&query.get('run')){selected=runs.find(r=>r.id===query.get('run'))||null;if(selected){const rows=replayRows(),month=Number(query.get('month')||0);replayIndex=Math.max(0,rows.findLastIndex(r=>r.year*12<=month))}}
      if(selected){selected=runs.find(r=>r.id===selected.id)||null;if(!selected)stop()}
      search=compileFutureSearch(searchQuery,metrics);renderAll();
    },
    destroy(){if(destroyed)return;destroyed=true;stop();buildingReplay?.destroy();for(const cleanup of cleanups)cleanup();root.remove()},
  };
}
