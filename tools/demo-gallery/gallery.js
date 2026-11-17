const gallery = document.querySelector('#gallery');
const status = document.querySelector('#status');
const group = document.querySelector('#collection');
const search = document.querySelector('#search');
function message(container, text) {
  const p = document.createElement('p');
  p.textContent = text;
  container.replaceChildren(p);
}
try {
  const { buildCatalog, filterCatalog, MANIFEST_VERSION } = await import('./manifest.js');
  const catalog = buildCatalog();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      const video = entry.target;
      video.src = video.dataset.src;
      observer.unobserve(video);
    }
  }, { root: gallery, rootMargin: '100px' });
  function render() {
    observer.disconnect();
    gallery.querySelectorAll('video').forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
    gallery.replaceChildren();
    const items = filterCatalog(catalog, group.value, search.value);
    status.textContent = `${items.length} demos · ${MANIFEST_VERSION}`;
    document.querySelector('#empty').hidden = items.length !== 0;
    for (const item of items) {
      const card = document.createElement('article');
      card.dataset.id = item.id;
      const media = document.createElement('div');
      media.className = 'media';
      const footer = document.createElement('footer');
      const title = document.createElement('h2');
      title.textContent = item.title;
      title.title = item.description;
      const actions = document.createElement('div');
      actions.className = 'actions';
      const link = document.createElement('a');
      link.href = item.route;
      link.textContent = 'Open demo →';
      link.setAttribute('aria-label', `Open ${item.title}`);
      actions.append(link);
      function show(kind) {
        const previous = media.querySelector('video');
        if (previous) { observer.unobserve(previous); previous.pause(); previous.removeAttribute('src'); previous.load(); }
        const src = item[kind];
        if (!src) { message(media, 'No preview yet. Open the demo to explore.'); return; }
        const element = document.createElement(kind === 'video' ? 'video' : 'img');
        element.addEventListener('error', () => message(media, `${kind === 'video' ? 'Video' : 'Image'} preview unavailable. Open the demo to explore.`), { once: true });
        if (kind === 'video') {
          element.controls = true;
          element.preload = 'none';
          element.playsInline = true;
          element.setAttribute('aria-label', `${item.title} video preview`);
          if (item.image) element.poster = item.image;
          element.dataset.src = src;
          observer.observe(element);
        } else { element.alt = `${item.title} preview`; element.loading = 'lazy'; element.decoding = 'async'; element.src = src; }
        media.replaceChildren(element);
      }
      for (const kind of ['image', 'video']) if (item[kind]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = kind === 'image' ? 'Image' : 'Video';
        button.setAttribute('aria-label', `${button.textContent} preview for ${item.title}`);
        button.addEventListener('click', () => show(kind));
        actions.append(button);
      }
      show(item.image ? 'image' : 'video');
      footer.append(title, actions);
      card.append(media, footer);
      gallery.append(card);
    }
    gallery.scrollTop = 0;
  }
  document.querySelector('#filters').addEventListener('submit', event => event.preventDefault());
  group.addEventListener('change', render);
  search.addEventListener('input', render);
  document.addEventListener('visibilitychange', () => { if (document.hidden) gallery.querySelectorAll('video').forEach(video => video.pause()); });
  render();
} catch {
  status.textContent = 'The preview collection could not load. Please reload or use the route directory.';
}
