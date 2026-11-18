import {DISTRICT_METRICS} from '../city/neighborhood-metrics.js';
import {pairedDistrictMetrics} from '../city/paired-neighborhood-diff.js';

/** Accessible district context over the same selected snapshots as the city scene. */
export function createDistrictComparison(host) {
  const doc=host.ownerDocument;
  const make=(tag,text)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const region=make('section');region.className='fm-district-comparison';region.setAttribute('aria-label','District comparison');
  const style=make('style',`.fm-district-comparison{margin:12px 0;padding:14px;border:1px solid #637b94;border-radius:12px;background:#101e30;color:#edf5ff;max-width:100%;box-sizing:border-box}.fm-district-comparison h2{margin:0 0 8px;font-size:1.1rem}.fm-district-comparison p{font-size:.85rem;overflow-wrap:anywhere}.fm-district-comparison select{max-width:100%;padding:8px;background:#182c43;color:#fff}.fm-district-comparison table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:.85rem}.fm-district-comparison th,.fm-district-comparison td{padding:8px 3px;text-align:left;overflow-wrap:anywhere;vertical-align:top;border-bottom:1px solid #34485d}.fm-district-comparison tr>:first-child{width:30%}.fm-district-comparison tr>:last-child{width:20%}.fm-district-comparison td small{display:block;color:#b9cce0}.fm-district-comparison .fm-district-bar{display:block;height:5px;background:#72b9f3;margin:5px 0}.fm-district-comparison .fm-district-plan{background:#e8c168}.fm-district-comparison caption{text-align:left;padding:10px 0}.fm-district-comparison [data-missing=true]{background:repeating-linear-gradient(135deg,transparent,transparent 4px,#ffffff0c 4px,#ffffff0c 8px)}`);
  const heading=make('h2','Where do the futures change?');
  const note=make('p','Synthetic district context · provisional 12-metric catalog. No cell locations or real neighborhood boundaries are inferred. Rent includes new inventory; link travel is not a resident commute.');
  const label=make('label','District metric '),picker=make('select');picker.setAttribute('aria-label','District metric');
  for(const metric of DISTRICT_METRICS){const option=make('option',metric.label);option.value=metric.id;picker.append(option);}picker.value='housing_units';label.append(picker);
  const table=make('table'),caption=make('caption'),head=make('thead'),header=make('tr'),body=make('tbody');
  for(const title of ['District','Without plan','With plan','Change']){const th=make('th',title);th.scope='col';header.append(th);}head.append(header);table.append(caption,head,body);
  region.append(style,heading,note,label,table);host.append(region);region.hidden=true;
  let frame=null,context={},lastFrame=null;
  const format=value=>value===null?'Unavailable':new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
  function render(){
    region.hidden=!frame;if(!frame)return;
    const rows=pairedDistrictMetrics(frame,context).filter(row=>row.metricId===picker.value);
    const metric=DISTRICT_METRICS.find(m=>m.id===picker.value);
    caption.textContent=`Month ${frame.month} · ${metric.unit} · seed ${frame.baseline.state.seed}. Bars share one scale across both futures at this month.`;
    const maximum=Math.max(1,...rows.flatMap(r=>[r.baseline,r.plan]).filter(Number.isFinite));
    body.replaceChildren(...rows.map(row=>{
      const tr=make('tr');tr.dataset.district=row.geographyId;const name=make('th',row.districtName);name.scope='row';tr.append(name);
      for(const arm of ['baseline','plan']){
        const source=row.sources[arm],cell=make('td',format(row[arm]));cell.dataset.arm=arm;cell.dataset.missing=String(row[arm]===null);
        const bar=make('span');bar.className=`fm-district-bar ${arm==='plan'?'fm-district-plan':''}`;bar.setAttribute('aria-hidden','true');bar.style.width=`${row[arm]===null?0:Math.max(0,row[arm])/maximum*100}%`;cell.append(bar);
        cell.append(make('small',source?`${source.sampleCount} samples${source.reason?' · '+source.reason:''}`:'District absent'));tr.append(cell);
      }
      const delta=make('td',row.delta===null?'Unavailable':`${row.delta>0?'+':''}${format(row.delta)}`);delta.dataset.delta='true';tr.append(delta);return tr;
    }));
  }
  picker.addEventListener('change',render);
  return {update(next,nextContext={}){if(next?.baseline===lastFrame?.baseline&&next?.plan===lastFrame?.plan)return;frame=next;lastFrame=next;context=nextContext;render();},dispose(){picker.removeEventListener('change',render);region.remove();frame=null;lastFrame=null;}};
}
