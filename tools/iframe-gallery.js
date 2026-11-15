(async () => {
  const rail = document.getElementById('carousel-rail');
  const jump = document.getElementById('carousel-jump');
  const categorySelect = document.getElementById('carousel-category');
  const status = document.getElementById('carousel-status');
  const catalog = document.getElementById('preview-catalog');
  if (!rail || !catalog) return;
  const categories = { worlds: '3D Worlds', living: 'Living Simulations', science: 'GPU Science', games: 'Games', tools: 'Tools' };
  const awaitPeek = await import('/tools/world-peek.js');
  const {EXPERIENCES}=await import('/world/universe/registry.js');
  const templates=[...catalog.content.querySelectorAll('section[data-carousel]')];
  const sources=EXPERIENCES.map(experience=>{
    const existing=templates.find(section=>section.querySelector('iframe')?.getAttribute('src')===experience.route);
    if(existing)return existing;
    const section=document.createElement('section');section.dataset.carousel=experience.category;
    const header=document.createElement('header'),title=document.createElement('h2'),description=document.createElement('p'),frame=document.createElement('iframe');
    title.textContent=experience.title;description.textContent=experience.description;header.append(title,description);frame.setAttribute('src',experience.route);frame.dataset.previewSrc=experience.preview;frame.title=experience.title;section.append(header,frame);return section;
  });
  const countHeading = document.getElementById('experience-count');
  if (countHeading) { const count = countHeading.querySelector("#gallery-count"); if (count) count.textContent = String(sources.length); else countHeading.textContent = `${sources.length} Interactive Worlds & Experiments`; }
  let active = 0, queued = false;
  const cards = sources.map((section, index) => {
    const source = section.querySelector('iframe');
    const title = section.querySelector('h2')?.textContent || source.title;
    const card = document.createElement('article');
    card.className = 'gallery-card';
    card.dataset.experienceId = EXPERIENCES[index].id;
    card.dataset.category = section.dataset.carousel;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'slide');
    card.setAttribute('aria-label', `${index + 1} of ${sources.length}: ${title}`);
    const header = document.createElement('header');
    const heading = document.createElement('h3');
    heading.textContent = title;
    const link = document.createElement('a');
    link.href = source.getAttribute('src');
    if (['world', 'living-city', 'future-machine'].includes(EXPERIENCES[index].id)) link.dataset.portalId = EXPERIENCES[index].id;
    link.rel = 'noopener';
    link.textContent = 'Enter world →';
    link.setAttribute('aria-label', `Enter ${title}`);
    header.append(heading, link);
    const viewport = document.createElement('div');
    viewport.className = 'gallery-viewport';
    const { mountPeek } = awaitPeek;
    const peek = mountPeek(viewport, EXPERIENCES[index], index);
    const description = document.createElement('p');
    description.className = 'preview-description';
    description.textContent = section.querySelector('header p')?.textContent || `Explore ${title}.`;
    const footer = document.createElement('footer');
    const number = document.createElement('span');
    number.textContent = `${String(index + 1).padStart(2, '0')} / ${sources.length} · ${categories[section.dataset.carousel]}`;
    footer.append(number, peek.button);
    card.append(header, viewport, description, footer);
    card.setInteraction = () => peek.close();
    card.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') peek.open(); });
    card.addEventListener('pointerleave', () => { if (!card.contains(document.activeElement)) peek.close(); });
    card.addEventListener('focusin', () => peek.open());
    card.addEventListener('focusout', event => { if (!card.contains(event.relatedTarget)) peek.close(); });
    card.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); peek.close(); } });
    card.previewTitle = title;
    rail.append(card);
    return card;
  });
  let filtered = cards;

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

    });
    for (const card of cards) {
      const current = card === filtered[active];
      card.classList.toggle('is-current', current);

    }
    jump.value = String(active);
    status.textContent = `${active + 1} / ${filtered.length}`;

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

  rebuildJump();
  update();
})();
