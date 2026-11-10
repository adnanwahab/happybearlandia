(() => {
  const rail = document.getElementById('carousel-rail');
  const jump = document.getElementById('carousel-jump');
  const status = document.getElementById('carousel-status');
  const groups = [ ['webgpu', 'WebGPU visualizations'], ['visualization', 'Other visualizations'], ['content', 'Content pages'] ];
  const sources = groups.flatMap(([category]) => [...document.querySelectorAll(`main > section[data-carousel="${category}"]`)].filter(section => section.querySelector('iframe')));
  const optionGroups = new Map(groups.map(([category, label]) => {
    const group = document.createElement('optgroup');
    group.label = label;
    jump.append(group);
    return [category, group];
  }));
  const cards = sources.map((section, index) => {
    const source = section.querySelector('iframe');
    const title = section.querySelector('h2')?.textContent || source.title;
    const card = document.createElement('article');
    card.className = 'gallery-card';
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
    const iframe = document.createElement('iframe');
    iframe.dataset.src = source.getAttribute('src');
    iframe.title = `${title} gallery preview`;
    iframe.loading = 'lazy';
    iframe.allowFullscreen = true;
    iframe.tabIndex = -1;
    viewport.append(iframe);
    const footer = document.createElement('footer');
    const number = document.createElement('span');
    const category = groups.find(([key]) => key === section.dataset.carousel)[1];
    number.textContent = `${String(index + 1).padStart(2, '0')} / ${sources.length} · ${category}`;
    const interact = document.createElement('button');
    interact.type = 'button';
    interact.textContent = 'Enable interaction';
    interact.setAttribute('aria-pressed', 'false');
    interact.setAttribute('aria-label', `Enable interaction with ${title}`);
    interact.addEventListener('click', () => {
      const enabled = card.classList.toggle('is-interactive');
      iframe.tabIndex = enabled ? 0 : -1;
      interact.textContent = enabled ? 'Disable interaction' : 'Enable interaction';
      interact.setAttribute('aria-pressed', String(enabled));
      interact.setAttribute('aria-label', `${enabled ? 'Disable' : 'Enable'} interaction with ${title}`);
    });
    footer.append(number, interact);
    card.append(header, viewport, footer);
    rail.append(card);
    optionGroups.get(section.dataset.carousel).append(new Option(title, String(index)));
    return card;
  });
  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const frame = entry.target.querySelector('iframe');
      if (entry.isIntersecting && !frame.hasAttribute('src')) frame.src = frame.dataset.src;
      if (!entry.isIntersecting && !entry.target.classList.contains('is-interactive')) frame.removeAttribute('src');
    }
  }, { root: rail, rootMargin: '100px', threshold: 0 });
  cards.forEach(card => visibility.observe(card));
  let active = 0, queued = false;
  function update() {
    queued = false;
    const bounds = rail.getBoundingClientRect();
    const center = bounds.width / 2;
    let nearest = Infinity;
    cards.forEach((card, index) => {
      const untransformedCenter = card.offsetLeft - rail.scrollLeft + card.offsetWidth / 2;
      const distance = untransformedCenter - center;
      if (Math.abs(distance) < nearest) { nearest = Math.abs(distance); active = index; }
      const normalized = Math.max(-1, Math.min(1, distance / bounds.width));
      card.style.setProperty('--angle', `${-normalized * 24}deg`);
      card.style.setProperty('--depth', `${-Math.abs(normalized) * 65}px`);
      card.style.setProperty('--preview-scale', card.clientWidth / 1100);
    });
    cards.forEach((card, index) => card.classList.toggle('is-current', index === active));
    jump.value = String(active);
    status.textContent = `${active + 1} / ${cards.length}`;
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  function go(index) {
    index = (index + cards.length) % cards.length;
    const card = cards[index];
    rail.scrollTo({ left: card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  document.getElementById('carousel-prev').addEventListener('click', () => go(active - 1));
  document.getElementById('carousel-next').addEventListener('click', () => go(active + 1));
  jump.addEventListener('change', () => go(Number(jump.value)));
  rail.addEventListener('keydown', event => {
    if (event.target !== rail) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); go(active + (event.key === 'ArrowRight' ? 1 : -1)); }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); go(event.key === 'Home' ? 0 : cards.length - 1); }
  });
  rail.addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(schedule).observe(rail);
  update();
})();
