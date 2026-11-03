const POLICY_DEMOS = {
  housing: {
    label: "Legalize more housing near jobs & transit",
    short: "Housing / zoning",
    description: "Increase permitted supply while varying construction cost, migration, delivery, and financing.",
    base: { homes: 8241, drainage: 0, commute: -1.6, rent: -4.8, spend: 185, improved: 71 },
    confidence: "LOW",
    model: "housing-demo-v1",
    failureWeights: { "construction costs spike": .36, "population growth exceeds supply": .31, "permitting implementation fails": .23, "financing tightens": .10 }
  },
  flood: {
    label: "Accelerate drainage & detention projects",
    short: "Flood / drainage",
    description: "Add drainage capacity and detention while varying storm severity, delivery delays, and material prices.",
    base: { homes: 620, drainage: 2.4, commute: -.3, rent: -.4, spend: 412, improved: 68 },
    confidence: "MEDIUM",
    model: "flood-demo-v1",
    failureWeights: { "severe flood event": .38, "project delivery delay": .28, "construction costs spike": .22, "maintenance underperforms": .12 }
  },
  transit: {
    label: "Build rapid bus corridors + transit-oriented zoning",
    short: "Transit / mobility",
    description: "Change bus speed, access, and nearby housing while varying adoption, congestion, and implementation.",
    base: { homes: 2800, drainage: 0, commute: -6.3, rent: -2.1, spend: 365, improved: 76 },
    confidence: "LOW",
    model: "mobility-demo-v1",
    failureWeights: { "ridership adoption stays low": .34, "road congestion rebounds": .25, "construction delay": .22, "population grows faster than service": .19 }
  }
};

const ASSUMPTIONS = [
  {id:"delivery",label:"Implementation delivery",min:.45,max:1.15,step:.01,value:.82,fmt:v=>Math.round(v*100)+"%",type:"Model assumption",source:"HBL demo prior",confidence:"low"},
  {id:"growth",label:"Population / demand growth",min:.6,max:1.5,step:.01,value:1.05,fmt:v=>v.toFixed(2)+"×",type:"Random scenario variable",source:"sampled per future",confidence:"scenario"},
  {id:"cost",label:"Construction cost pressure",min:.7,max:1.6,step:.01,value:1.00,fmt:v=>v.toFixed(2)+"×",type:"Model assumption",source:"HBL demo prior",confidence:"low"},
  {id:"adoption",label:"Resident adoption / response",min:.4,max:1.2,step:.01,value:.82,fmt:v=>Math.round(v*100)+"%",type:"Model assumption",source:"HBL demo prior",confidence:"low"}
];

const state={policy:"housing",assumptions:Object.fromEntries(ASSUMPTIONS.map(a=>[a.id,a.value])),runs:[],future:0,year:10};
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let x=seed||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}}
function gaussian(r){let u=Math.max(r(),1e-9),v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function fmtMetric(k,v){
  if(k==="homes")return Math.round(v).toLocaleString()+" homes built";
  if(k==="drainage")return v.toFixed(1)+" miles drainage added";
  if(k==="commute")return (v>=0?"+":"")+v.toFixed(1)+" min commute";
  if(k==="rent")return (v>=0?"+":"")+v.toFixed(1)+"% rent";
  if(k==="spend")return "$"+Math.round(v).toLocaleString()+"M expenditure";
  return Math.round(v)+"% households improved";
}
function simulateOne(i){
  const p=POLICY_DEMOS[state.policy],r=rng(hash("hbl-guided-"+i));
  const macro=clamp(1+gaussian(r)*.12,.6,1.45);
  const migration=clamp(state.assumptions.growth+gaussian(r)*.16,.55,1.65);
  const delivery=clamp(state.assumptions.delivery+gaussian(r)*.13,.25,1.25);
  const cost=clamp(state.assumptions.cost+gaussian(r)*.17,.65,1.75);
  const adoption=clamp(state.assumptions.adoption+gaussian(r)*.12,.25,1.25);
  const storm=clamp(1+gaussian(r)*.28,.45,1.9);
  const effectiveness=clamp(delivery*adoption*(1.12-cost*.12)*(1.05+(macro-1)*.18),.22,1.35);
  const demandPenalty=Math.max(0,migration-1)*.55;
  let homes=p.base.homes*effectiveness*(state.policy==="housing" ? 1.1-cost*.14 : 1);
  let drainage=p.base.drainage*delivery*(state.policy==="flood"?1.14-storm*.08:1);
  let commute=p.base.commute*effectiveness + (migration-1)*2.4;
  let rent=p.base.rent*effectiveness + demandPenalty*5.2;
  let spend=p.base.spend*(.76+delivery*.26)*(state.assumptions.cost*.88+.12);
  let improved=p.base.improved*effectiveness - Math.max(0,migration-1)*12 - Math.max(0,storm-1)*(state.policy==="flood"?5:1.5);
  if(state.policy==="flood") improved += (1-storm)*6;
  improved=clamp(improved,8,96);
  const score=(improved-50)/18 + (-rent)/7 + (-commute)/8 - Math.max(0,spend-500)/250;
  const verdict=score>.75?"improve":score<-.15?"worse":"mixed";
  let failure=null;
  if(verdict==="worse"||verdict==="mixed"){
    const signals={
      "construction costs spike":cost-1,
      "population growth exceeds supply":migration-1,
      "permitting implementation fails":.8-delivery,
      "financing tightens":1-macro,
      "severe flood event":storm-1,
      "project delivery delay":.8-delivery,
      "maintenance underperforms":.72-adoption,
      "ridership adoption stays low":.78-adoption,
      "road congestion rebounds":migration*1.05-adoption,
      "construction delay":.82-delivery,
      "population grows faster than service":migration-adoption
    };
    failure=Object.keys(p.failureWeights).sort((a,b)=>(signals[b]||0)*p.failureWeights[b]-(signals[a]||0)*p.failureWeights[a])[0];
  }
  return {i,macro,migration,delivery,cost,adoption,storm,effectiveness,homes,drainage,commute,rent,spend,improved,verdict,failure};
}
function run100(){
  state.runs=Array.from({length:100},(_,i)=>simulateOne(i));
  state.future=0; state.year=10; $("#year").value=10; $("#yearValue").textContent="10";
  renderAll(); setStep(3);
}
function mean(k){return state.runs.reduce((s,r)=>s+r[k],0)/(state.runs.length||1)}
function renderPolicies(){
  $("#policies").innerHTML=Object.entries(POLICY_DEMOS).map(([id,p])=>`<button class="policy ${id===state.policy?"active":""}" data-policy="${id}"><strong>${p.short}</strong><small>${p.label}<br>${p.description}</small></button>`).join("");
  document.querySelectorAll("[data-policy]").forEach(b=>b.onclick=()=>{state.policy=b.dataset.policy;renderPolicies();run100()});
}
function renderAssumptions(){
  $("#assumptions").innerHTML=ASSUMPTIONS.map(a=>`<div class="assumption"><div class="assumptionHead"><b>${a.label}</b><output id="out-${a.id}">${a.fmt(state.assumptions[a.id])}</output></div><input data-a="${a.id}" type="range" min="${a.min}" max="${a.max}" step="${a.step}" value="${state.assumptions[a.id]}"><div class="meta"><span class="provtag">${a.type}</span><span class="provtag">${a.source}</span><span class="provtag">confidence: ${a.confidence}</span></div></div>`).join("");
  document.querySelectorAll("[data-a]").forEach(el=>el.oninput=()=>{const a=ASSUMPTIONS.find(x=>x.id===el.dataset.a);state.assumptions[a.id]=+el.value;$("#out-"+a.id).textContent=a.fmt(+el.value);setStep(6)});
  document.querySelectorAll("[data-a]").forEach(el=>el.onchange=run100);
}
function renderMetrics(){
  const keys=["homes","drainage","commute","rent","spend","improved"];
  $("#metrics").innerHTML=keys.map(k=>`<button class="metric" data-metric="${k}"><small>${({homes:"Housing",drainage:"Infrastructure",commute:"Mobility",rent:"Affordability",spend:"Budget",improved:"Households"})[k]}</small><b>${fmtMetric(k,mean(k))}</b><small>click for provenance & drivers</small></button>`).join("");
  document.querySelectorAll("[data-metric]").forEach(b=>b.onclick=()=>renderWhy(b.dataset.metric));
}
function renderDistribution(){
  const counts={improve:0,mixed:0,worse:0};state.runs.forEach(r=>counts[r.verdict]++);
  $("#distribution").innerHTML=[
    ["improve","improve","good"],["mixed","mixed","mixed"],["worse","worse","bad"]
  ].map(([k,l,c])=>`<div class="barrow"><span>${l}</span><div class="track"><div class="fill ${c}" style="width:${counts[k]}%"></div></div><b>${counts[k]}</b></div>`).join("");
  const f={};state.runs.filter(r=>r.failure).forEach(r=>f[r.failure]=(f[r.failure]||0)+1);
  const rows=Object.entries(f).sort((a,b)=>b[1]-a[1]).slice(0,4);
  $("#failures").innerHTML=rows.length?rows.map(([name,n])=>`<div class="failure"><b>${n}</b> — ${name}</div>`).join(""):"<div class='muted'>No failed/mixed futures in this run.</div>";
}
function renderWhy(k){
  const p=POLICY_DEMOS[state.policy],r=state.runs[state.future]||{};
  const defs={
    homes:["Homes built",["+ modeled build capacity × delivery","+ zoning/supply policy effectiveness","− construction cost pressure","− implementation delay"]],
    drainage:["Drainage added",["+ project delivery","+ infrastructure policy scale","− cost pressure","− severe storm disruption"]],
    commute:["Median commute change",["+ transit speed / access","+ resident adoption","− population & traffic growth","− implementation delay"]],
    rent:["Rent change",["+ additional housing supply","+ vacancy / competition response","− population growth","− construction cost pressure"]],
    spend:["City expenditure",["+ policy capital cost","+ implementation scale","× construction cost pressure"]],
    improved:["Households improved on ≥3 modeled outcomes",["+ housing / mobility / resilience gains","+ adoption","− adverse shocks","− demand growth outrunning capacity"]]
  };
  const [title,drivers]=defs[k];
  $("#why").innerHTML=`<h3>${title}: ${fmtMetric(k,r[k]??mean(k))}</h3>
  <div><span class="tag">Derived estimate</span><span class="tag">Confidence: ${p.confidence}</span><span class="tag">Model: ${p.model}</span></div>
  <ul>${drivers.map(d=>`<li>${d}</li>`).join("")}</ul>
  <p><b>Future #${state.future+1} conditions:</b> delivery ${Math.round((r.delivery||0)*100)}%, demand ${(r.migration||0).toFixed(2)}×, costs ${(r.cost||0).toFixed(2)}×, adoption ${Math.round((r.adoption||0)*100)}%, storm ${(r.storm||0).toFixed(2)}×.</p>
  <p class="fine"><b>Evidence layer:</b> current demo values are HBL modeling assumptions and generated scenario variables. Replace these provenance entries with linked municipal datasets/studies before treating the result as decision evidence.</p>`;
  setStep(5);
}
function drawCity(){
  const c=$("#city"),ctx=c.getContext("2d"),r=state.runs[state.future]||simulateOne(0),t=state.year/10,p=POLICY_DEMOS[state.policy];
  ctx.clearRect(0,0,c.width,c.height);
  const g=ctx.createLinearGradient(0,0,0,c.height);g.addColorStop(0,"#102c2d");g.addColorStop(1,"#07100f");ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle="#17342c";ctx.fillRect(0,285,c.width,105);
  ctx.strokeStyle="#304d45";ctx.lineWidth=16;ctx.beginPath();ctx.moveTo(0,335);ctx.lineTo(900,300);ctx.stroke();
  const rr=rng(hash("city-"+state.future));
  for(let i=0;i<45;i++){const x=15+i*20+(rr()-.5)*12,h=22+rr()*85;ctx.fillStyle=i%4===0?"#243f38":"#1d342e";ctx.fillRect(x,285-h,14,h);ctx.fillStyle="#d9bd6c55";for(let y=285-h+8;y<280;y+=13)ctx.fillRect(x+4,y,3,4)}
  if(state.policy==="housing"){
    const n=Math.round(4+clamp(r.homes/2200,0,8)*t);for(let i=0;i<n;i++){const x=470+i*34,y=286,h=40+18*(i%3)+t*28;ctx.fillStyle="#466c5d";ctx.fillRect(x,y-h,26,h);ctx.strokeStyle="#f0c76b";ctx.lineWidth=2;ctx.strokeRect(x,y-h,26,h)}
  } else if(state.policy==="flood"){
    ctx.strokeStyle="#7cc8ff";ctx.lineWidth=4;ctx.setLineDash([10,8]);for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(80,315+i*15);ctx.bezierCurveTo(280,250-i*20,520,360+i*8,820,280-i*12);ctx.stroke()}ctx.setLineDash([]);
    ctx.fillStyle="#7cc8ff33";ctx.fillRect(0,345,900,45*(1-t*clamp(r.delivery,0,1)));
  } else {
    ctx.strokeStyle="#f0c76b";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(30,325);ctx.lineTo(860,292);ctx.stroke();for(let i=0;i<7;i++){const x=130+i*105;ctx.fillStyle="#7cc8ff";ctx.fillRect(x,300-i*4,36,12)}
  }
  const people=Math.round(20+30*t);for(let i=0;i<people;i++){ctx.fillStyle=i%3===0?"#f0c76b":"#8db7a7";ctx.beginPath();ctx.arc(25+(i*37)%850,300+(i*17)%58,2.2,0,Math.PI*2);ctx.fill()}
  ctx.fillStyle="#effaf4";ctx.font="13px ui-monospace";ctx.fillText(`${p.short} · Future #${state.future+1} · Year ${state.year}`,18,24);
}
function renderFuture(){
  const r=state.runs[state.future]; if(!r)return;
  $("#futureLabel").textContent=`Future #${state.future+1} · ${r.verdict.toUpperCase()} · year ${state.year}`;
  drawCity();
}
function renderAll(){renderMetrics();renderDistribution();renderFuture()}
function setStep(n){document.querySelectorAll(".step").forEach((s,i)=>s.classList.toggle("active",i===n))}
function initLoop(){const labels=["IDEA","SIMULATE","100 FUTURES","COMPARE","ENTER FUTURE","WHY?","CHANGE ASSUMPTION","RUN AGAIN"];$("#loop").innerHTML=labels.map((x,i)=>`<div class="step ${i===0?"active":""}">${x}</div>`).join("")}
function challenge(){
  const transit=+$("#transit").value,zoning=+$("#zoning").value,bus=+$("#bus").value,parking=+$("#parking").value;
  let ok=0;
  for(let i=0;i<100;i++){const r=rng(hash("challenge-"+i)),growth=.85+r()*.45,delivery=.55+r()*.55,adoption=.55+r()*.5,shock=r()<.15?.75:1;
    const spend=transit*(.82+.35/delivery)+zoning*.45+bus*.35+parking*.12;
    const reduction=(transit/600)*8.5+(zoning/100)*2.8+(bus/100)*5.2+(parking/100)*1.5;
    const realized=reduction*delivery*adoption*shock-(growth-1)*3.5;
    if(realized>=38*.15 && spend<=500)ok++;
  }
  $("#challengeScore").textContent=ok;
}
function bindChallenge(){
  [["transit","transitOut",v=>"$"+v+"M"],["zoning","zoningOut",v=>v+"%"],["bus","busOut",v=>v+"%"],["parking","parkingOut",v=>v+"%"]].forEach(([id,out,f])=>$("#"+id).oninput=e=>$("#"+out).textContent=f(e.target.value));
  $("#runChallenge").onclick=challenge;
}
initLoop();renderPolicies();renderAssumptions();run100();bindChallenge();
$("#run").onclick=()=>{setStep(1);run100()};
$("#prevFuture").onclick=()=>{state.future=(state.future+99)%100;renderFuture();setStep(4)};
$("#nextFuture").onclick=()=>{state.future=(state.future+1)%100;renderFuture();setStep(4)};
$("#year").oninput=e=>{state.year=+e.target.value;$("#yearValue").textContent=state.year;renderFuture();setStep(4)};
