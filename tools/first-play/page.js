import {aggregateFirstPlay} from './aggregate.js';
const status = document.querySelector('#status'), result = document.querySelector('#result');
function table(headers, rows) {
  const wrap=document.createElement('div');wrap.className='scroll';
  const table=document.createElement('table');
  for (const [i,row] of [headers,...rows].entries()) {
    const tr=document.createElement('tr');
    for (const value of row) {const cell=document.createElement(i===0?'th':'td');cell.textContent=value;tr.append(cell);}
    table.append(tr);
  }
  wrap.append(table);return wrap;
}
document.querySelector('#file').addEventListener('change',async event=>{
  result.replaceChildren();
  const file=event.target.files[0];if(!file)return;
  try {
    if(file.size>10*1024*1024)throw Error('Export exceeds 10 MB.');
    const report=aggregateFirstPlay(JSON.parse(await file.text()));
    status.textContent=`${report.kind === 'synthetic-fixture'?'SYNTHETIC TEST FIXTURE':'Recorded export'} · ${report.source} · ${report.observationStart} to ${report.observationEnd} (end exclusive)`;
    result.append(table(['Stage','Events','Ordered sessions','From previous stage'],report.stages.map(row=>[row.type,row.events,row.sessions,row.conversion===null?'Unavailable':`${(row.conversion*100).toFixed(1)}%`])));
    result.append(table(['UTC landing cohort','Landing sessions','Started','First change'],report.cohorts.map(row=>[row.date,row.landingSessions,row.startedSessions,row.changedSessions])));
    const detail=document.createElement('pre');detail.textContent=`D1 / D7 retention: ${report.retention.reason}\n\n${report.limitations.join('\n')}\n\n${report.duplicateEvents} duplicate events removed; ${report.excludedBotSessions} bot sessions excluded.`;result.append(detail);
  } catch(error) {status.textContent=`Unavailable — ${error.message}`;}
});
