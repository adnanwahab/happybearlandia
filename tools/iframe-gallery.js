(() => {
  const rail = document.getElementById('carousel-rail');
  const jump = document.getElementById('carousel-jump');
  const categorySelect = document.getElementById('carousel-category');
  const status = document.getElementById('carousel-status');
  const catalog = document.getElementById('preview-catalog');
  if (!rail || !catalog) return;
  const categories = { worlds: '3D Worlds', living: 'Living Simulations', science: 'GPU Science', games: 'Games', tools: 'Tools' };
  const sources = [...catalog.content.querySelectorAll('section[data-carousel]')];
  let active = 0, queued = false, visible = true;
  const cards = sources.map((section, index) => {
    const source = section.querySelector('iframe');
    const title = section.querySelector('h2')?.textContent || source.title;
    const card = document.createElement('article');
    card.className = 'gallery-card';
    card.dataset.category = section.dataset.carousel;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'slide');
    card.setAttribute('aria-label', `${index + 1} of ${sources.length}: ${title}`);
    const header = document.createElement('header');
    const heading = document.createElement('h3');
    heading.textContent = title;
    const link = document.createElement('a');
    link.href = source.getAttribute('src');
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Open full page ↗';
    link.setAttribute('aria-label', `Open ${title} in a new tab`);
    header.append(heading, link);
    const viewport = document.createElement('div');
    viewport.className = 'gallery-viewport';
    const loading = document.createElement('span');
    loading.className = 'preview-loading';
    loading.textContent = 'Loading live preview…';
    const iframe = document.createElement('iframe');
    iframe.dataset.src = source.dataset.previewSrc || source.getAttribute('src');
    iframe.title = `${title} gallery preview`;
    iframe.loading = 'eager';
    iframe.allowFullscreen = true;
    iframe.tabIndex = -1;
    let readyTimer = null;
    iframe.addEventListener('load', () => {
      clearTimeout(readyTimer);
      if (!iframe.hasAttribute('src')) return;
      const started = performance.now();
      function reveal() {
        if (!iframe.hasAttribute('src')) return;
        // The flagship starts directly in its canvas, without flashing setup UI.
        const isWorld = iframe.dataset.src.startsWith('/world?embed=1');
        if (!isWorld || iframe.contentDocument?.querySelector('#view canvas')) {
          card.classList.add('is-loaded');
        } else if (performance.now() - started < 45000) {
          readyTimer = setTimeout(reveal, 150);
        } else {
          loading.textContent = 'Preview unavailable. Open the full page to explore.';
        }
      }
      reveal();
    });
    viewport.append(loading, iframe);
    const description = document.createElement('p');
    description.className = 'preview-description';
    description.textContent = section.querySelector('header p')?.textContent || `Explore ${title} in a live interactive preview.`;
    const footer = document.createElement('footer');
    const number = document.createElement('span');
    number.textContent = `${String(index + 1).padStart(2, '0')} / ${sources.length} · ${categories[section.dataset.carousel]}`;
    const interact = document.createElement('button');
    interact.type = 'button';
    function setInteraction(enabled) {
      card.classList.toggle('is-interactive', enabled);
      iframe.tabIndex = enabled ? 0 : -1;
      interact.textContent = enabled ? 'Stop interacting' : 'Interact';
      interact.setAttribute('aria-pressed', String(enabled));
      interact.setAttribute('aria-label', `${enabled ? 'Stop interacting' : 'Interact'} with ${title}`);
    }
    setInteraction(false);
    interact.addEventListener('click', () => {
      if (!card.classList.contains('is-current')) go(filtered.indexOf(card), false);
      setInteraction(!card.classList.contains('is-interactive'));
    });
    footer.append(number, interact);
    card.append(header, viewport, description, footer);
    card.setInteraction = setInteraction;
    card.previewTitle = title;
    rail.append(card);
    return card;
  });
  let filtered = cards;

  // Only the current preview and immediate neighbors own live browsing contexts.
  // Original sources live in an inert template, so there are no duplicate apps.
  function loadNearby() {
    const nearby = new Set(visible && !document.hidden ? filtered.slice(Math.max(0, active - 1), active + 2) : []);
    for (const card of cards) {
      const frame = card.querySelector('iframe');
      if (nearby.has(card)) {
        if (!frame.hasAttribute('src')) {
          card.querySelector('.preview-loading').textContent = 'Loading live preview…';
          frame.src = frame.dataset.src;
        }
      } else if (frame.hasAttribute('src')) {
        card.setInteraction(false);
        frame.removeAttribute('src');
        card.classList.remove('is-loaded');
      }
    }
  }
  function update() {
    queued = false;
    const center = rail.clientWidth / 2;
    let nearest = Infinity;
    filtered.forEach((card, index) => {
      const distance = card.offsetLeft - rail.scrollLeft + card.offsetWidth / 2 - center;
      if (Math.abs(distance) < nearest) { nearest = Math.abs(distance); active = index; }
      const normalized = Math.max(-1, Math.min(1, distance / rail.clientWidth));
      card.style.setProperty('--angle', `${-normalized * 24}deg`);
      card.style.setProperty('--depth', `${-Math.abs(normalized) * 65}px`);
      card.style.setProperty('--preview-scale', card.clientWidth / 1100);
    });
    for (const card of cards) {
      const current = card === filtered[active];
      card.classList.toggle('is-current', current);
      if (!current) card.setInteraction(false);
    }
    jump.value = String(active);
    status.textContent = `${active + 1} / ${filtered.length}`;
    loadNearby();
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  function go(index, smooth = true) {
    index = (index + filtered.length) % filtered.length;
    const card = filtered[index];
    rail.scrollTo({ left: card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
    schedule();
  }
  function rebuildJump() {
    jump.replaceChildren(...filtered.map((card, index) => new Option(`${index + 1}. ${card.previewTitle}`, String(index))));
  }
  categorySelect.addEventListener('change', () => {
    filtered = cards.filter(card => categorySelect.value === 'all' || card.dataset.category === categorySelect.value);
    cards.forEach(card => { card.hidden = !filtered.includes(card); card.setInteraction(false); });
    active = 0;
    rebuildJump();
    go(0, false);
  });
  document.getElementById('carousel-prev').addEventListener('click', () => go(active - 1));
  document.getElementById('carousel-next').addEventListener('click', () => go(active + 1));
  jump.addEventListener('change', () => go(Number(jump.value), false));
  rail.addEventListener('keydown', event => {
    if (event.target !== rail) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); go(active + (event.key === 'ArrowRight' ? 1 : -1)); }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); go(event.key === 'Home' ? 0 : filtered.length - 1, false); }
  });
  rail.addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(schedule).observe(rail);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; loadNearby(); }).observe(rail);
  document.addEventListener('visibilitychange', loadNearby);
  rebuildJump();
  update();
})();
