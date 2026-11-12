import { EXPERIENCES, getExperience, searchExperiences, entityActions } from './registry.js';
import { mountFunAnalytics } from './fun-analytics.js';
import { mountLocalJourneyControls } from './local-journeys.js';
import { contextFromURL, contextURL, shellURL, createFrameBridge } from './navigation.js';

const root = document.getElementById('universe-shell');
if (root) {
  let context;
  let contextError = '';
  function readContext() {
    try { return contextFromURL(location.href); }
    catch { contextError = 'Invalid context in URL. Open a valid shared link to restore it.'; return contextFromURL('/'); }
  }
  context = readContext();
  let active = null;
  let disconnect = () => {};
  root.innerHTML = `<div class="universe-kicker">One living world · ${EXPERIENCES.length} connected experiences</div>
    <h2>Follow a world. Explore its futures.</h2>
    <p>World is the stage. Worldline explores possible futures. The causal inspector explains recorded model dependencies.</p>
    <nav aria-label="Universe navigation"><a data-app="world">Enter World</a><a data-app="worldline">Explore Worldline</a><a data-app="experiments">Experiments</a><a id="universe-model">Recorded World model</a></nav>
    <section id="universe-demos" aria-label="Try the new connected demos">
      <h3>Choose Your First Adventure</h3>
      <div class="universe-missions">
        <article><small>Synthetic demo</small><h4>See 20 months of city change</h4><p>Open the recorded city and find out when a housing project was completed.</p><a data-demo-route="/world/causal.html">Start Time Machine</a></article>
        <article><small>Synthetic demo</small><h4>Save Riverside Bakery</h4><p>Trace the missing flour deliveries and test when to reopen the road.</p><a data-demo-route="/world/journeys/bakery.html">Open the bakery case</a></article>
        <article><small>Synthetic demo</small><h4>Help a Commuter</h4><p>Meet a Riverside worker and compare two versions of their commute.</p><a data-demo-route="/world/living-city/">Start the commute challenge</a></article>
      </div>
      <p><a data-demo-route="/tools/future-journey.html">Saved Future Journey</a></p>
      <nav aria-label="Demo shortcuts">
        <a data-demo-route="/world/causal.html">Time Machine</a>
        <a data-demo-route="/world/living-city/">Living City challenge</a>
        <a data-demo-route="/world/journeys/bakery.html">Riverside Bakery mystery</a>
        <a data-demo-route="/world/newspaper/index.html">Living Newspaper</a>
        <a data-demo-route="/world/discoveries/index.html">Surprising Discoveries</a>
        <a data-demo-route="/world/causality/inspect.html">Causal inspector</a>
      </nav>
    </section>
    <div class="universe-context" aria-label="Current universe context"></div>
    <p id="universe-context-error" role="alert"></p>
    <div class="universe-actions" aria-label="Selected entity actions"></div>
    <label for="universe-search">Find an experience by name, topic, or route</label>
    <input id="universe-search" type="search" placeholder="Try Worldline, climate, or /world/house" autocomplete="off">
    <p class="universe-status" role="status" aria-live="polite"></p>
    <div class="universe-results" aria-label="Experience directory"></div>
    <div id="universe-stage"></div><div id="universe-local-controls"></div>`;
  const journeys=mountLocalJourneyControls(root.querySelector('#universe-local-controls'));
  mountFunAnalytics(root.querySelector('#universe-local-controls'));
  const visited=new Set();
  const results = root.querySelector('.universe-results');
  const stage = root.querySelector('#universe-stage');
  const status = root.querySelector('.universe-status');
  function link(label, href) {
    const a = document.createElement('a'); a.textContent = label; a.href = href; return a;
  }
  function renderContext() {
    root.querySelector('#universe-context-error').textContent = contextError;
    const bar = root.querySelector('.universe-context'); bar.replaceChildren();
    for (const [key,value] of Object.entries(context)) {
      const span = document.createElement('span'); span.textContent = `${key}: ${value}`; bar.append(span);
    }
    if (!bar.childNodes.length) bar.textContent = 'Choose a world to begin. Context travels with you.';
    for (const a of root.querySelectorAll('[data-app]')) a.href = shellURL(a.dataset.app,context);
    root.querySelector('#universe-model').href = contextURL('/world/causal.html',context);
    for (const a of root.querySelectorAll('#universe-demos [data-demo-route]'))
      a.href = contextURL(a.dataset.demoRoute,context);
    if (!root.querySelector('#universe-research')) { const research=link('Research institutions',contextURL('/world/research/index.html',context));research.id='universe-research';root.querySelector('nav').append(research); }
    root.querySelector('#universe-research').href=contextURL('/world/research/index.html',context);
    const actions = root.querySelector('.universe-actions'); actions.replaceChildren();
    for (const app of entityActions(context)) actions.append(link(`View entity in ${app.title}`,shellURL(app.id,context)));
    if (context.entityId) {
      actions.append(link('Explain recorded dependencies',contextURL('/world/causality/inspect.html',context)));
      actions.append(link('Research institutions',contextURL('/world/research/index.html',context)));
    }
    renderResults();
    updateGalleryLinks();
  }
  function renderResults() {
    results.replaceChildren();
    const matches = searchExperiences(root.querySelector('input').value);
    for (const app of matches) {
      const article = document.createElement('article'); article.className = 'universe-card';
      const title = document.createElement('h3'); title.textContent = app.title;
      const badge = document.createElement('small'); badge.textContent = `${app.evidence} · ${app.role}`;
      const description = document.createElement('p'); description.textContent = app.description;
      const open = link('Enter',shellURL(app.id,context)); open.dataset.app = app.id;
      article.append(title,badge,description,open,link('Standalone ↗',contextURL(app.route,context)));
      if(app.category==='science') article.append(link('Research institution',contextURL('/world/research/index.html',context)));
      results.append(article);
    }
    status.textContent = `${matches.length} of ${EXPERIENCES.length} experiences. World geometry can be observed; model outputs are synthetic. Fictional narratives are labeled separately.`;
  }
  function updateGalleryLinks() {
    for (const a of document.querySelectorAll('#carousel-rail a')) {
      try { a.href = contextURL(a.getAttribute('href'),context); } catch { /* unrelated links */ }
    }
  }
  new MutationObserver(updateGalleryLinks).observe(document.getElementById('carousel-rail'),{childList:true,subtree:true});
  function activate(id,{push=true}={}) {
    const app = getExperience(id);
    disconnect(); stage.replaceChildren(); active = app || null;
    if (push) history.pushState(null,'',shellURL(app?.id,context));
    if (!app) { if (id) status.textContent = 'Unknown experience. Choose an entry from the directory.'; return; }
    const heading = document.createElement('h3'); heading.textContent = app.title;
    const standalone = link('Open standalone ↗',contextURL(app.route,context));
    const close = document.createElement('button'); close.textContent = 'Close experience'; close.type = 'button';
    close.addEventListener('click',()=>activate(null));
    const frame = document.createElement('iframe'); frame.title = `${app.title} universe experience`;
    // Only the chosen experience is instantiated. No offscreen GPU previews.
    frame.src = contextURL(app.preview,context); frame.allowFullscreen = true;
    disconnect = createFrameBridge({frame,context:()=>context,onContext(next) {
      context = next; history.replaceState(null,'',shellURL(active?.id,context)); renderContext();
      standalone.href = contextURL(app.route,context);
    },onNavigate:activate});
    stage.append(heading,standalone,close,frame);
    stage.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }
  root.addEventListener('click',event=>{
    const a = event.target.closest('a[data-app]');
    if (!a || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button) return;
    event.preventDefault();
    visited.add(a.dataset.app);
    if(visited.size >= 2) journeys.record('second-connected-experience');
    if(a.dataset.app === 'worldline') journeys.record('future-entry');
    activate(a.dataset.app);
  });
  root.addEventListener('click',event=>{if(event.target.closest('a')?.textContent === 'Explain recorded dependencies') journeys.record('causal-link-click');});
  root.querySelector('input').addEventListener('input',renderResults);
  addEventListener('popstate',()=>{contextError='';context=readContext();renderContext();activate(new URL(location.href).searchParams.get('app'),{push:false});});
  renderContext();
  const initial = new URL(location.href).searchParams.get('app');
  if (initial && !contextError) activate(initial,{push:false});
}
