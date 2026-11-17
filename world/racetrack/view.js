import { admitTracks, frame, leadChanges } from './contract.js';
const root=document.querySelector('#racetrack');
const $=s=>root.querySelector(s);
const controller=new AbortController();
let laneController=new AbortController();
let lanes=[], month=0, timer=null, disposed=false;
const rows=new Map();
function stop() {clearInterval(timer);timer=null;$('#race-play').textContent='Play';}
function render() {
  const current=frame(lanes,month);
  $('#race-time').textContent=`Month ${month} · ${2026+Math.floor(month/12)}-${String(month%12+1).padStart(2,'0')}`;
  $('#race-month').value=month;
  $('#race-month').setAttribute('aria-valuetext',$('#race-time').textContent);
  for(const point of current) {
    const row=rows.get(point.id);
    row.value.textContent=point.value===null?'Missing observation':`${point.value} homes`;
    row.marker.hidden=point.position===null;
    row.marker.style.left=`${100*(point.position??0)}%`;
  }
  const changes=leadChanges(lanes,month).map(change=>`${change.ahead} moved ahead of ${change.behind}`);
  $('#race-changes').textContent=changes.length?`First recorded ahead at month ${month} (since month ${month-1}): ${changes.join('; ')}.`:'No newly recorded lead changes at this timepoint. Missing values are not compared.';
}
function showReceipt(lane) {
  stop();
  $('#race-receipt-text').textContent=JSON.stringify({selectedMonth:month,recordedValue:lane.values[month],receipt:lane},null,2);
  $('#race-receipt').showModal();
}
async function load(bundle) {
  stop();
  const result=await admitTracks(bundle);
  if(disposed)return;
  laneController.abort();laneController=new AbortController();
  lanes=result.lanes;month=0;rows.clear();$('#race-lanes').replaceChildren();
  for(const lane of lanes) {
    const row=document.createElement('button');row.type='button';row.className='race-lane';
    const label=document.createElement('span');label.textContent=lane.label;
    const track=document.createElement('span');track.className='race-track';track.setAttribute('aria-hidden','true');
    const marker=document.createElement('i');track.append(marker);
    const value=document.createElement('span');
    row.append(label,track,value);row.addEventListener('click',()=>showReceipt(lane),{signal:laneController.signal});
    $('#race-lanes').append(row);rows.set(lane.id,{marker,value});
  }
  $('#race-status').textContent=`${lanes.length} aligned lanes${lanes.length?` · pinned seed ${lanes[0].seed}`:''}. ${result.excluded.length} excluded. ${result.excluded.map(e=>`Lane ${e.index+1}: ${e.reason}`).join('; ')}`;
  for(const el of [$('#race-play'),$('#race-month'),$('#race-next')])el.disabled=!lanes.length;
  render();
}
$('#race-play').addEventListener('click',()=>{
  if(timer){stop();return;}
  if(month===120)month=0;
  $('#race-play').textContent='Pause';render();
  timer=setInterval(()=>{month++;render();if(month===120)stop();},500);
},{signal:controller.signal});
$('#race-next').addEventListener('click',()=>{
  stop();
  for(let next=month+1;next<=120;next++)if(leadChanges(lanes,next).length){month=next;render();return;}
  $('#race-changes').textContent='No later recorded lead changes.';
},{signal:controller.signal});
$('#race-month').addEventListener('input',e=>{stop();month=Number(e.target.value);render();},{signal:controller.signal});
$('#race-close').addEventListener('click',()=>$('#race-receipt').close(),{signal:controller.signal});
$('#race-import').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try {if(file.size>2_000_000)throw Error('File exceeds 2 MB');await load(JSON.parse(await file.text()));}
  catch(error){$('#race-status').textContent=`Import failed: ${error.message}. Previous lanes retained.`;}
},{signal:controller.signal});
addEventListener('pagehide',event=>{if(event.persisted){stop();return;}disposed=true;stop();controller.abort();laneController.abort();rows.clear();lanes=[];$('#race-lanes').replaceChildren();$('#race-receipt').close();$('#race-receipt-text').textContent='';},{signal:controller.signal});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();},{signal:controller.signal});
try {
  const response=await fetch('./racetrack/representative.json',{signal:controller.signal});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  await load(await response.json());
} catch(error){if(!disposed)$('#race-status').textContent=`Recorded lanes unavailable: ${error.message}. No live results substituted.`;}
