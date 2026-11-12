import {KEY,CONSENT,WEEK,weekStart,read,weekly} from './retention.js';
const $=s=>document.querySelector(s),date=t=>new Date(t).toISOString().slice(0,10);
const now=Date.now(),start=weekStart(now);
for(let i=0;i<8;i++){const option=document.createElement('option');option.value=start-i*WEEK;option.textContent=date(+option.value);$('#week').append(option);}
function render(){try{
 const result=weekly(read(localStorage,now),Number($('#week').value),now);
 $('#status').textContent=localStorage.getItem(CONSENT)==='yes'?'Local observations enabled.':'Local observations disabled.';
 $('#period').textContent=`Cohort [${date(result.start)}, ${date(result.end)}) UTC; return window [${date(result.end)}, ${date(result.nextEnd)}) UTC. ${result.mature?'Complete observation window.':'Provisional: return window incomplete; numerator and rate withheld.'}`;
 $('#rows').replaceChildren();for(const [label,m] of [['Repeat-play',result.repeat],['Shared-link return',result.shared]]){const row=document.createElement('tr');for(const text of [label,`${m.numerator??'Pending'} / ${m.denominator}`,m.numerator===null?'Pending':m.denominator?`${(100*m.numerator/m.denominator).toFixed(1)}%`:'Unavailable (empty cohort)']){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}$('#rows').append(row);}
 }catch{$('#status').textContent='Browser storage unavailable; no observations collected.';}}
$('#enable').onclick=()=>{try{localStorage.setItem(CONSENT,'yes');render();}catch{$('#status').textContent='Browser storage unavailable.';}};
$('#clear').onclick=()=>{try{localStorage.removeItem(CONSENT);localStorage.removeItem(KEY);render();}catch{$('#status').textContent='Browser storage unavailable.';}};$('#week').onchange=render;render();
