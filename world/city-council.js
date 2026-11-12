import {policySchedule} from './city-memory.js';
import {households,projectHousehold,getFamilyReviewMonth,getCurrentHouseholds} from './follow-family.js';
const key='hbl-city-council-v1';
const compromises={affordability:[0,1],restaurant:[0,1],commute:[0,1],flooding:[0,2],happiness:[0,1],family:[0,1]};
export function councilFeedback(mission,choices,plans={}){
  const next={...plans,[mission.id]:[...choices]};
  return households.map(h=>{
    const before=projectHousehold(h,plans),after=projectHousehold(h,next);
    const concerns=[];const benefits=[];
    if(after.income<before.income)concerns.push('Our take-home pay would fall. How will we cover the bills?');
    if(after.rent<before.rent)benefits.push('Lower rent would leave us more room in our budget.');
    if(after.commute<before.commute)benefits.push('A shorter commute means more time at home.');
    if(after.floodRisk<before.floodRisk)benefits.push('These defenses would make our home safer.');
    if(after.happiness>before.happiness)benefits.push('This would improve our everyday life.');
    if(after.balance<0)concerns.push('We would still be spending more than we earn.');
    if(mission.id==='family'&&h.id==='rivera'&&choices.includes(2))concerns.push('A studio is too small for our family.');
    if(mission.id==='commute'&&h.id==='brooks')concerns.push('Please review school access too; this scenario only measures average commute time.');
    const score=Math.sign(after.balance-before.balance)+Math.sign(before.commute-after.commute)+Math.sign(after.happiness-before.happiness)+Math.sign(before.floodRisk-after.floodRisk);
    return {id:h.id,name:h.name,stance:concerns.length?'Concerned':benefits.length?'Supportive':'Undecided',text:[...benefits,...concerns].join(' ')||'Show us how this proposal will affect our household.',before,score};
  });
}
export function trustChange(before,after,success){
 const impact=Math.sign((after.balance-(after.stormCost||0))-(before.balance-(before.stormCost||0)))+Math.sign(before.commute-after.commute)+Math.sign(after.happiness-before.happiness)+Math.sign(before.floodRisk-after.floodRisk);
 return Math.max(-10,Math.min(10,impact*2+(success?2:-3)));
}
let state={trust:{rivera:50,chen:50,brooks:50},pending:{},settled:{},journal:[]};
function persist(){try{localStorage.setItem(key,JSON.stringify(state))}catch{}}
function load(){try{const v=JSON.parse(localStorage.getItem(key));if(v&&typeof v==='object'){
 for(const h of households)if(Number.isFinite(v.trust?.[h.id]))state.trust[h.id]=Math.max(0,Math.min(100,v.trust[h.id]));
 state.pending=v.pending&&typeof v.pending==='object'?v.pending:{};state.settled=v.settled&&typeof v.settled==='object'?v.settled:{};
 state.journal=Array.isArray(v.journal)?v.journal.filter(s=>typeof s==='string').slice(-12):[];
 }}catch{}}
function render(){const root=document.querySelector('#city-council');if(!root)return;
 root.innerHTML=`<span class="tag">LISTEN. DECIDE. FOLLOW THROUGH.</span><h2>City Council Night</h2><p>Run a plan to hear from residents before it takes effect. Revise it, adopt a compromise, or proceed. Advance months in Follow a Family to see how delivered results affect trust. Reviews wait until the proposal’s scheduled completion.</p><div class="family-metrics">${households.map(h=>`<div class="metric"><span>${h.name} · trust</span><b>${state.trust[h.id]} / 100</b></div>`).join('')}</div><p id="council-pending"></p><h3 class="section-title">COUNCIL RECORD</h3><ol id="council-record"></ol>`;
 root.querySelector('#council-pending').textContent=`${Object.keys(state.pending).length} proposal(s) awaiting a monthly review. Trust starts at 50; results and whether the mission’s objectives were met determine changes.`;
 for(const entry of state.journal.slice().reverse()){const li=document.createElement('li');li.textContent=entry;root.querySelector('ol').append(li)}
 if(!state.journal.length)root.querySelector('ol').textContent='The next meeting starts when you run a challenge plan.';
}
export function openCouncil(mission,selected,plans,evaluate,adopt){
 document.querySelector('#council-dialog')?.remove();
 const choices=[...selected].sort();const comments=councilFeedback(mission,choices,plans);const compromise=compromises[mission.id];
 const dialog=document.createElement('dialog');dialog.id='council-dialog';dialog.setAttribute('aria-labelledby','council-title');
 dialog.innerHTML=`<span class="tag">PUBLIC MEETING · PROPOSAL REVIEW</span><h2 id="council-title">City Council Night</h2><p>${mission.title}</p><h3 class="section-title">YOUR PROPOSAL</h3><ul>${choices.map(i=>`<li>${mission.policies[i][0]} <small>· full effects after ${policySchedule[mission.id][i].delay} month(s)</small></li>`).join('')||'<li>No policy changes</li>'}</ul><div class="council-comments">${comments.map(c=>`<blockquote><strong>${c.name}</strong><span class="council-stance">${c.stance}</span><p>${c.text}</p></blockquote>`).join('')}</div><div class="council-compromise"><strong>Suggested compromise</strong><p>${compromise.map(i=>mission.policies[i][0]).join(' + ')}.</p><small>This replaces your selected policies. Mission objectives still apply.</small></div><div class="actions"><button id="council-revise" class="secondary">Revise proposal</button><button id="council-compromise">Adopt compromise</button><button id="council-proceed">Proceed with proposal</button></div><p class="family-note">Adoption starts the policy timeline. Household benefits arrive as projects finish; residents review results at scheduled completion. Testimony describes the completed plan.</p>`;
 document.body.append(dialog);
 const commit=(next,mode)=>{
 const signature=JSON.stringify(next.slice().sort());
 // Re-running an identical adopted plan cannot repeatedly earn trust.
 if(state.settled[mission.id]!==signature){state.pending[mission.id]={signature,name:mission.name,success:evaluate(mission,next).success,reviewMonth:getFamilyReviewMonth(mission.id,next),before:state.pending[mission.id]?.before||getCurrentHouseholds()};}
 else delete state.pending[mission.id];
 state.journal.push(`${mission.name}: ${mode}. Review follows scheduled completion.`);state.journal=state.journal.slice(-12);persist();dialog.close();adopt(next);render();
 };
 dialog.querySelector('#council-revise').onclick=()=>dialog.close();
 dialog.querySelector('#council-compromise').onclick=()=>commit(compromise,'compromise adopted');
 dialog.querySelector('#council-proceed').onclick=()=>commit(choices,'original proposal adopted');
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();dialog.querySelector('#council-revise').focus();
}
export function initCouncil(){load();render();
 window.addEventListener('family-month',e=>{
  for(const [id,p] of Object.entries(state.pending)){
   if(!p||typeof p.signature!=='string'||!p.before)continue;
   if(Number.isFinite(p.reviewMonth)&&e.detail.month<p.reviewMonth)continue;
   const changes=[];
   for(const h of households){const before=p.before[h.id];if(!before||!Number.isFinite(before.balance))continue;const after=e.detail.households?.[h.id]||projectHousehold(h,e.detail.plans);const delta=trustChange(before,after,p.success);state.trust[h.id]=Math.max(0,Math.min(100,state.trust[h.id]+delta));changes.push(`${h.name} ${delta>=0?'+':''}${delta}`);}
   state.journal.push(`Month ${e.detail.month}: ${p.name}. ${p.success?'Completed plan meets projected mission objectives.':'Plan misses projected mission objectives.'} Trust: ${changes.join('; ')}.`);state.settled[id]=p.signature;delete state.pending[id];
  }
  state.journal=state.journal.slice(-12);persist();render();
 });
 window.addEventListener('family-reset',()=>{state={trust:{rivera:50,chen:50,brooks:50},pending:{},settled:{},journal:[]};persist();render()});
}
