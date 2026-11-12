(() => {
  const cards = [...document.querySelectorAll('.card')];
  const search = document.querySelector('#search');
  const filters = [...document.querySelectorAll('[data-filter]')];
  const count = document.querySelector('#result-count');
  const empty = document.querySelector('#empty-state');
  let category = 'all';
  function update() {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    for (const card of cards) {
      card.hidden = !(category === 'all' || card.dataset.category === category) || !card.textContent.toLowerCase().includes(query);
      if (!card.hidden) visible++;
    }
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
    count.textContent = visible === cards.length ? 'Showing all 7 experiments' : `Showing ${visible} of 7 experiments`;
    empty.hidden = visible !== 0;
  }
  filters.forEach(button => button.addEventListener('click', () => { category = button.dataset.filter; update(); }));
  search.addEventListener('input', update);
  document.querySelector('#reset-filters').addEventListener('click', () => { category = 'all'; search.value = ''; update(); search.focus(); });
  const check = document.querySelector('#check-gpu');
  const status = document.querySelector('#gpu-status');
  const detail = document.querySelector('#gpu-detail');
  check.addEventListener('click', async () => {
    check.disabled = true;
    check.textContent = 'Checking…';
    try {
      const adapter = navigator.gpu && await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('unavailable');
      status.textContent = 'WebGPU adapter available';
      detail.textContent = 'Your browser can access a GPU adapter. Open an experiment to run its workload.';
      document.querySelector('.status-dot').style.background = '#b4ee84';
    } catch {
      status.textContent = 'WebGPU is unavailable in this browser';
      detail.textContent = 'Try a WebGPU-enabled browser with hardware acceleration. You can still browse the collection and read each model’s explanation.';
      document.querySelector('.status-dot').style.background = '#ffb08c';
    } finally {
      check.disabled = false;
      check.textContent = 'Check again ↻';
    }
  });
})();
