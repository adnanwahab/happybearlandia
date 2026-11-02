export const BUSINESS_SAVE_KEY = 'hbl-business-lab.v1';
import { validateDefinition } from './models/business-v1/schema.js';
// Business mode shares the world's residents, paths, clock and purchasing decisions.
export function placeBusiness(world, building, settings = {}) {
  const site = world.buildings[building];
  if (!site || !['food', 'shop', 'work'].includes(site.kind)) throw new Error('Choose a food, shop or work building.');
  const number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  const previous = world.business;
  world.business = {
    name: String(settings.name || 'My neighborhood business').trim().slice(0, 60),
    building,
    price: number(settings.price, 12, .01, 1000000),
    quality: number(settings.quality, 75, 1, 100),
    unitCost: number(settings.unitCost, 4, 0, 1000000),
    stock: previous?.stock ?? 100,
    visits: previous?.visits ?? 0,
    revenue: previous?.revenue ?? 0,
    costs: previous?.costs ?? 100 * number(settings.unitCost, 4, 0, 1000000),
    open: previous?.open ?? true,
  };
  return world.business;
}

export function mountBusinessMode(world, { onPlace, onFocus }) {
  document.documentElement.classList.add('business-mode');
  const panel = document.createElement('section');
  panel.id = 'businessPanel';
  panel.className = 'panel';
  panel.innerHTML = `
    <h1>🐻 Your neighborhood business</h1>
    <p class="muted">Choose a shop, food or office building on the map, or select a location below. Residents walk here and buy when the offer meets their needs.</p>
    <form id="businessForm">
      <label>Business name<input id="businessName" maxlength="60" value="My neighborhood business" required></label>
      <label>Location<select id="businessSite" required><option value="">Choose a building…</option></select></label>
      <div class="row"><label>Price ($)<input id="businessPrice" type="number" min="1" max="100" step="0.5" value="12" required></label>
      <label>Quality (1–100)<input id="businessQuality" type="number" min="1" max="100" value="75" required></label></div>
      <button type="submit" id="businessLaunch">Place & open business</button>
    </form>
    <p id="businessStatus" role="status">Select a location to get started.</p>
    <div id="businessMetrics" aria-live="polite"></div>
    <div class="row"><button id="businessToggle" disabled>Close business</button><button id="businessRestock" disabled>Buy 100 stock · $400</button><button id="businessFocus" disabled>Show business</button></div>
    <p class="muted">Open 7am–9pm. Stock costs $4 per item; quality and price influence demand. Profit = sales minus purchased inventory. Illustrative simulation, no rent or payroll. Changes apply immediately; this session resets on reload.</p>
    <a href="/business-simulator">← Business Lab</a>`;
  document.body.append(panel);
  let approvedCompany = null;
  try {
    const saved = JSON.parse(localStorage.getItem(BUSINESS_SAVE_KEY) || 'null');
    if (saved?.state?.def?.approved && validateDefinition(saved.state.def).valid) approvedCompany = saved;
  } catch {}
  const cost = approvedCompany?.state.def.unitCost ?? 4;
  if (approvedCompany) {
    panel.querySelector('#businessName').value = approvedCompany.state.def.name;
    panel.querySelector('#businessPrice').value = approvedCompany.plan.price;
    panel.querySelector('#businessQuality').value = approvedCompany.plan.quality;
    panel.querySelector('h1').textContent = '🐻 Place your approved company';
    const note = document.createElement('p'); note.className = 'muted';
    note.textContent = `Business Lab definition v${approvedCompany.state.def.version}. This live neighborhood is a separate visitor simulation; its sales do not alter the Lab timeline or futures.`;
    panel.querySelector('h1').after(note);
  }
  const priceInput = panel.querySelector('#businessPrice'); priceInput.min = '.01'; priceInput.max = '1000000'; priceInput.step = '.01';
  panel.querySelector('#businessRestock').textContent = `Buy 100 stock · $${(cost * 100).toFixed(2)}`;
  panel.querySelectorAll('p.muted')[panel.querySelectorAll('p.muted').length - 1].textContent = `Open 7am–9pm. Stock costs $${cost.toFixed(2)} per item; price and quality influence demand. Profit = sales minus purchased stock. Neighborhood placements reset on reload; your company is saved in Business Lab.`;
  const get = id => panel.querySelector(`#${id}`);
  for (const b of world.buildings.filter(b => ['food', 'shop', 'work'].includes(b.kind))) {
    const option = document.createElement('option');
    option.value = b.index; option.textContent = `${b.name} · ${b.kind}`;
    get('businessSite').append(option);
  }
  let last = '';
  const update = () => {
    const b = world.business;
    if (!b) return;
    const visitors = world.people.filter(p => p.action === 'visit_business' && p.mode === 'doing' && p.target === b.building).length;
    const heading = `${b.name} · ${b.open ? (world.isDaytime() ? 'Open' : 'Opens at 7am') : 'Closed'}`;
    const metrics = `${visitors} here now · ${b.visits} purchases · ${b.stock} in stock\nSales $${b.revenue.toFixed(2)} · Profit $${(b.revenue - b.costs).toFixed(2)}`;
    if (heading + metrics !== last) {
      get('businessStatus').textContent = heading;
      get('businessMetrics').textContent = metrics;
      last = heading + metrics;
    }
    get('businessToggle').textContent = b.open ? 'Close business' : 'Open business';
  };
  get('businessForm').onsubmit = e => {
    e.preventDefault();
    const b = placeBusiness(world, Number(get('businessSite').value), {
      unitCost: cost, name: get('businessName').value, price: get('businessPrice').value, quality: get('businessQuality').value,
    });
    onPlace(world.buildings[b.building]);
    for (const id of ['businessToggle', 'businessRestock', 'businessFocus']) get(id).disabled = false;
    get('businessLaunch').textContent = 'Apply changes';
    world.log('Your business is ready for customers.', 'business', world.buildings[b.building]);
    update();
  };
  get('businessToggle').onclick = () => { world.business.open = !world.business.open; update(); };
  get('businessRestock').onclick = () => { world.business.stock += 100; world.business.costs += 100 * world.business.unitCost; update(); };
  get('businessFocus').onclick = () => onFocus(world.buildings[world.business.building]);
  return {
    update,
    choose(building) {
      if (!['food', 'shop', 'work'].includes(building.kind)) {
        get('businessStatus').textContent = 'Choose a shop, food or office building; homes, parks and schools remain available to residents.';
        return;
      }
      get('businessSite').value = building.index;
      get('businessStatus').textContent = `Selected ${building.name}. Press ${world.business ? 'Apply changes' : 'Place & open business'} to confirm.`;
    },
  };
}
