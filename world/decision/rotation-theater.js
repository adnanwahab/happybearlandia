import { compatibleLandscapeRuns, decisionRunReceiptURL } from './visualizations.js';
const slots = [['baseline','Baseline'],['plan-a','A'],['plan-b','B'],['stress','Stress']];
const finite = Number.isFinite;
// A common final-year clock and run index are required in addition to the seed.
export function rotationPanels(data = {}, index) {
  const experiment = data.experiment;
  const rows = experiment ? compatibleLandscapeRuns(experiment, data.runs || []).filter(r => !r.error) : [];
  const baseline = experiment?.scenarios?.filter(s => s.kind === 'baseline') || [];
  const bases = rows.filter(r => r.scenarioId === baseline[0]?.id && Number.isInteger(r.runIndex));
  const anchor = bases.find(r => r.runIndex === index) || (index == null ? bases[0] : null);
  return slots.map(([kind,label]) => {
    const scenarios = experiment?.scenarios?.filter(s => s.kind === kind) || [];
    const matches = anchor && scenarios.length === 1 && finite(experiment.years) ? rows.filter(r => !scenarios[0].timelineFork && !r.timelineFork && r.scenarioId === scenarios[0].id && r.seed === anchor.seed && r.runIndex === anchor.runIndex && finite(r.metrics.housing_supply) && r.metrics.housing_supply >= 0) : [];
    const run = matches.length === 1 ? matches[0] : null;
    return {kind,label,scenario:scenarios[0],run,receipt:run ? decisionRunReceiptURL(experiment,run) : null};
  });
}
export function mountRotationTheater(container) {
  const doc = container.ownerDocument;
  const node = (tag,text) => { const n=doc.createElement(tag); if(text) n.textContent=text; return n; };
  container.classList.add('rotation-theater');
  const heading=node('h3','Four-world rotation theater');
  const note=node('p','Final-year synthetic housing outcomes. Shared schematic camera; no geographic placement or forecast. Select a panel or use arrow keys to rotate the featured world.');
  const status=node('p'); status.setAttribute('role','status');
  const stage=node('div'); stage.className='rotation-panels';
  container.append(heading,note,status,stage);
  let featured=0, panels=[], data={};
  const buttons=[];
  const feature = i => {
    featured=(i+4)%4;
    [...stage.children].forEach((tile,j)=>{tile.style.order=String((j-featured+4)%4);tile.dataset.featured=String(j===featured);buttons[j].setAttribute('aria-pressed',String(j===featured));});
    status.textContent=`Featured: ${panels[featured]?.label || slots[featured][1]}${panels[featured]?.run ? ` · seed ${panels[featured].run.seed} · year ${data.experiment.years}` : ' · unavailable'}`;
  };
  slots.forEach(([,label],i)=>{
    const tile=node('article'),button=node('button',`Feature ${label}`);
    button.type='button';buttons.push(button);tile.append(button);stage.append(tile);
    button.addEventListener('click',()=>feature(i));
    button.addEventListener('keydown',event=>{
      const step={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];
      if(step){event.preventDefault();const next=(i+step+4)%4;feature(next);buttons[next].focus();}
    });
  });
  function update(next={}) {
    data=next;panels=rotationPanels(data);
    const max=Math.max(1,...panels.map(p=>p.run?.metrics.housing_supply || 0));
    panels.forEach((p,i)=>{
      const tile=stage.children[i];while(tile.children.length>1)tile.lastChild.remove();
      tile.append(node('h4',p.scenario?.name || p.label));
      if(!p.run){tile.append(node('p','Unavailable — no unique compatible seed-matched receipt for this scenario.'));return;}
      const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 320 160');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Housing supply ${p.run.metrics.housing_supply}. Common scale 0 to ${max}.`);
      // Identical orthographic framing and scale; bar is data, scenery is absent.
      const rect=doc.createElementNS(svg.namespaceURI,'rect');
      for(const [key,value] of Object.entries({x:32,y:24,width:256*p.run.metrics.housing_supply/max,height:90,fill:'currentColor'}))rect.setAttribute(key,String(value));
      svg.append(rect);tile.append(svg,node('p',`${p.run.metrics.housing_supply.toLocaleString()} homes · year ${data.experiment.years}`),node('p',`Seed ${p.run.seed} · run index ${p.run.runIndex} · ${p.run.modelVersion} / ${p.run.engineVersion}`));
      const receipt=node('a',`Stored receipt: ${p.run.id}`);receipt.href=p.receipt;tile.append(receipt);
    });feature(featured);
  }
  update();return {update};
}
