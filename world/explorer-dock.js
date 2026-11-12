// Main World exploration tools; other simulation modes retain their own UI.
const query = new URLSearchParams(location.search);
if (!['living', 'business', 'business_mode', 'embed'].some(key => ['1', 'true'].includes(query.get(key)))) {
  document.body.classList.add('world-explorer');
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = '/world/explorer-dock.css'; document.head.append(style);
  const dock = document.createElement('section');
  dock.className = 'explorer-dock'; dock.setAttribute('aria-label', 'World explorer');
  dock.innerHTML = `<a class="explorer-home" href="/" aria-label="Return home">HBL / WORLD</a><h2>Your neighborhood, in motion.</h2><p>Explore a place, meet its residents, then see how a policy changes their lives.</p><div class="explorer-actions"><button type="button" data-action="place">1 · Choose a place</button><button type="button" data-action="policy">2 · Try a policy</button><button type="button" data-action="focus" aria-pressed="false">Focus on map</button><button type="button" data-action="share">Copy world link</button></div><div class="explorer-status" role="status">Drag to explore · Scroll to zoom · Select a resident to inspect</div>`;
  document.body.append(dock);
  const sizeObserver = new ResizeObserver(() => {
    document.body.style.setProperty('--explorer-height', `${dock.hidden ? 0 : dock.getBoundingClientRect().height}px`);
  });
  sizeObserver.observe(dock);
  const completed = new Set();
  const minimize = document.createElement('button');
  minimize.type = 'button'; minimize.dataset.action = 'minimize';
  minimize.textContent = 'Minimize'; minimize.setAttribute('aria-expanded', 'true');
  const dismiss = document.createElement('button');
  dismiss.type = 'button'; dismiss.dataset.action = 'dismiss'; dismiss.textContent = 'Dismiss';
  dock.append(minimize, dismiss);
  function collapse(value) {
    dock.classList.toggle('is-collapsed', value);
    minimize.textContent = value ? 'Explore neighborhood' : 'Minimize';
    minimize.setAttribute('aria-expanded', String(!value));
  }
  const status = dock.querySelector('[role=status]');
  dock.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button) return;
    const action = button.dataset.action;
    if (action === 'minimize') collapse(!dock.classList.contains('is-collapsed'));
    if (action === 'dismiss') { dock.hidden = true; document.getElementById('world-guide-button')?.focus({preventScroll:true}); }

    if (action === 'focus') {
      const active = document.body.classList.toggle('world-map-focus');
      button.setAttribute('aria-pressed', String(active)); button.textContent = active ? 'Show controls' : 'Focus on map';
      status.textContent = active ? 'Map focus is on. Select Show controls to return to the simulation tools.' : 'Simulation controls restored.';
    }
    if (action === 'place' || action === 'policy') {
      document.body.classList.remove('world-map-focus');
      const focus = dock.querySelector('[data-action=focus]'); focus.setAttribute('aria-pressed', 'false'); focus.textContent = 'Focus on map';
      const panel = document.getElementById('top'); panel.open = true;
      const target = document.getElementById(action === 'place' ? 'preset' : 'policy');
      target?.focus(); target?.scrollIntoView({block:'nearest'});
      completed.add(action);
      if (completed.size === 2) { collapse(true); minimize.focus({preventScroll:true}); }
      status.textContent = action === 'place' ? 'Choose a preset place or enter latitude and longitude in the controls.' : 'Choose a plan, then Run cycle to compare one week against no plan.';
    }
    if (action === 'share') {
      try { await navigator.clipboard.writeText(location.href); status.textContent = 'World link copied. Share it to open this location and configuration.'; }
      catch { status.textContent = 'Copy the address from your browser to share this world.'; }
    }
  });
}

// Optional modules mount asynchronously. Give their launchers one flow layout
// instead of letting each module claim the same viewport edge.
if (document.body.classList.contains('world-explorer')) {
  const utilities = document.createElement('nav');
  utilities.className = 'world-utilities'; utilities.setAttribute('aria-label', 'World display tools');
  document.body.append(utilities);
  function arrangeUtilities() {
    for (const node of document.querySelectorAll('#global-illumination-button, .scrapbook-open, button[aria-label="Open graphics settings"], nav[aria-label="Connected universe"], .constitution-link')) {
      if (node.parentElement !== utilities) utilities.append(node);
    }
  }
  const observer = new MutationObserver(arrangeUtilities);
  observer.observe(document.body, {childList:true, subtree:true});
  arrangeUtilities();
  // On narrow screens only one expanded controls sheet fits beside the map.
  document.addEventListener('toggle', event => {
    const panel = event.target;
    if (innerWidth > 900 || !panel.open || !panel.matches('#top, .bw-world-tools')) return;
    for (const other of document.querySelectorAll('#top, .bw-world-tools')) if (other !== panel) other.open = false;
  }, true);
}
