import {DEFAULT_RECIPE} from '../future-machine/contracts.js';
import {createShareURL} from '../future-machine/share/index.js';

export const TOUR_VERSION = 'magic-tour.1';
// Links configure an experiment, never certify execution or transfer identities.
export function tourStops() {
  const city = month => {
    const url = new URL(createShareURL({recipe:DEFAULT_RECIPE,month},'https://hbl.invalid/world/future-machine.html'));
    return url.pathname + url.search;
  };
  return [
    {id:'arrive',title:'1 · Arrive in the world',time:'1 minute',href:'/world?demo=1&living=1&seed=42&people=16&lat=29.7286&lng=-95.4746',action:'Open Living World',text:'Synthetic Population world. Open Camera and choose Skyline, then Street. Reduced motion: choose a still view; there is no required camera animation. If WebGPU is unavailable, the city-only viewer is geometry, not a substitute simulation.'},
    {id:'household',title:'2 · Play a household moment',time:'3 minutes',href:'/world?demo=1&living=1&seed=42&people=16&lat=29.7286&lng=-95.4746',action:'Select a resident in Living World',text:'Select a resident and use the House entry control to save and open that exact household. Request Read or Rest, resume, then pause and inspect the recorded action. Requires a working Population runtime and save access. Missing resident, denied save or unavailable graphics means this stop is unfinished; do not create a replacement identity.'},
    {id:'fork',title:'3 · Try one policy fork',time:'2 minutes',href:city(0),action:'Open the pinned housing fork',text:`A separate synthetic monthly City experiment: ${DEFAULT_RECIPE.modelVersion}, seed 42, 30 households, 120 months. Propose 24 homes in district d1 for 1,000,000 illustrative USD, delay 0, compliance 1. This does not change the household you just played. Both arms start from identical inputs.`},
    {id:'compare',title:'4 · Compare the futures',time:'2 minutes',href:city(16),action:'Compare at Month 16',text:'Use WITHOUT / WITH and the shared month timeline. Inspect homes and cumulative capital spending in the actual completed run. This link recomputes the same recipe; to retain one run identity across views, use the owning view’s saved experiment link. Failed or missing runs have no tour results.'},
    {id:'sources',title:'5 · Ask why',time:'1 minute',href:city(16),action:'Open the comparison and inspect WHY',text:'Open WHY for a metric and inspect its run, model version, seed, month, inputs and event evidence. Monthly City rules and synthetic inventory are assumptions; they are not observations of real residents. Missing causal records remain missing. A single seed does not measure uncertainty.'},
    {id:'conclude',title:'6 · Keep a conclusion',time:'1 minute',href:city(120),action:'Open the final comparison',text:'In the completed comparison, inspect the evidence report and preview its share recipe before choosing to copy it. Keep your notes private by default. The recipe recreates a synthetic City experiment, not your Population household or a causal explanation of its life. Do not include resident media or third-party content without explicit rights. This guide uploads nothing and retains no personal notes; there is no new hosted object to delete.'},
  ];
}

export function mountMagicTour(root) {
  const doc=root.ownerDocument,win=doc.defaultView,stops=tourStops();
  const heading=doc.createElement('h2');heading.textContent='The Ten-Minute Magic Tour';
  const intro=doc.createElement('p');intro.textContent='Six guided stops, at your pace. This itinerary is a preview: household handoff and a single shared run still require the owning views. Opening a stop is not evidence that its simulation succeeded.';
  const nav=doc.createElement('div');nav.setAttribute('role','group');nav.setAttribute('aria-label','Tour stops');
  const panel=doc.createElement('div');panel.id='magic-tour-stop';
  const title=doc.createElement('h3'),text=doc.createElement('p'),link=doc.createElement('a'),status=doc.createElement('p');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  panel.append(title,text,link,status);root.append(heading,intro,nav,panel);
  const buttons=stops.map(stop=>{const b=doc.createElement('button');b.type='button';b.textContent=stop.title;b.setAttribute('aria-controls',panel.id);b.addEventListener('click',()=>{const url=new URL(win.location.href);url.hash=`tour=${stop.id}`;win.history.pushState(null,'',url);render();});nav.append(b);return b;});
  function render(){
    const hash=win.location.hash;
    const id=hash.startsWith('#tour=')?hash.slice(6):'arrive';
    const index=stops.findIndex(s=>s.id===id),stop=stops[index];
    buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
    if(!stop){title.textContent='Tour stop unavailable';text.textContent='This bookmark is not a supported tour stop. Choose a stop above. No replacement simulation was started.';link.hidden=true;link.removeAttribute('href');status.textContent='No evidence of completion.';return;}
    title.textContent=stop.title; text.textContent=stop.text;link.textContent=stop.action+' →';link.href=stop.href;link.hidden=false;
    status.textContent=`${stop.time} suggested · ${TOUR_VERSION} · Not verified complete. Use browser Back to return to this stop.`;
  }
  win.addEventListener('popstate',render);win.addEventListener('hashchange',render);render();
  return ()=>{win.removeEventListener('popstate',render);win.removeEventListener('hashchange',render);root.replaceChildren();};
}
