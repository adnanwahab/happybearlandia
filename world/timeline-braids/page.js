import { firstDifference, listLivingSaves, traits } from './comparison.js';

const find = id => document.getElementById(id);
const form = document.querySelector('form');
const status = find('status');
const root = form.elements.root;
const person = form.elements.person;
const colors = ['#c8ec9c', '#6de3e0', '#efb68c', '#c6b1fa', '#f6e18c', '#92c6f4'];
let data;
let worker;
const query = new URLSearchParams(location.search);

function choose(row) {
  const income = row.income === null ? 'Unavailable' : '$' + Math.round(row.income).toLocaleString();
  find('snapshot').textContent =
    `${row.label ?? row.id} · Minute ${row.minute} · ${row.home ?? 'Home unavailable'} · ${row.employed ? row.employer ?? 'Employed' : 'No current employment'} · ${income} modeled annual income`;
  const params = new URLSearchParams({ experiment: row.id });
  find('world').href = '/world?' + params;
  params.set('person', row.personId);
  find('zoom').href = '/world/civilization-zoom/?' + params;
  params.set('playableLife', '1');
  find('house').href = '/world/house/' + encodeURIComponent(row.householdId) + '?' + params;
  history.replaceState(null, '', '?' + new URLSearchParams({
    experiment: data.rootId, person: data.personId, checkpoint: row.id,
  }));
}

function svg(tag, attributes) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

function draw(branches) {
  const height = Math.max(115, branches.length * 37 + 48);
  const picture = svg('svg', { viewBox: `0 0 760 ${height}`, 'aria-label': 'Saved checkpoint threads' });
  const locations = new Map();
  const depth = Math.max(2, ...branches.map(path => path.length));
  for (const [lane, path] of branches.entries()) {
    for (const [index, row] of path.entries()) {
      if (!locations.has(row.id)) locations.set(row.id, { x: 32 + index * 690 / (depth - 1), ys: [], row });
      locations.get(row.id).ys.push(37 + lane * 37);
    }
  }
  for (const value of locations.values()) value.y = value.ys.reduce((a, b) => a + b, 0) / value.ys.length;
  const edges = new Set();
  for (const [lane, path] of branches.entries()) {
    for (let index = 1; index < path.length; index++) {
      const a = locations.get(path[index - 1].id);
      const b = locations.get(path[index].id);
      if (edges.has(b.row.id)) continue;
      edges.add(b.row.id);
      const mid = (a.x + b.x) / 2;
      picture.append(svg('path', {
        d: `M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`,
        stroke: colors[lane % colors.length], 'stroke-width': 3, fill: 'none',
      }));
    }
  }
  for (const { row, x, y } of locations.values()) {
    const link = svg('a', { href: '/world?' + new URLSearchParams({ experiment: row.id }), 'aria-label': `Inspect ${row.label ?? row.id}, minute ${row.minute}` });
    link.addEventListener('click', event => { event.preventDefault(); choose(row); });
    const label = svg('title', {});
    label.textContent = `${row.label ?? row.id} · minute ${row.minute}`;
    link.append(label, svg('circle', { cx: x, cy: y, r: 9, fill: '#eff5df' }));
    picture.append(link);
  }
  find('braid').replaceChildren(picture);
}

function compare() {
  const a = Number(find('left').value);
  const b = Number(find('right').value);
  const difference = firstDifference(data.branches[a], data.branches[b]);
  const result = find('difference');
  if (a === b) {
    result.textContent = 'Choose two different branches.';
    return;
  }
  if (!difference) {
    result.textContent = 'No difference found at a shared saved minute on these branches.';
    return;
  }
  const { minute, left, right, fields } = difference;
  const format = (row, key) => {
    if (key === 'homeId') return row.home ?? row.homeId;
    if (key === 'employerId') return row.employer ?? row.employerId;
    if (key === 'employed') return row.employed ? 'Employed' : 'No current employment';
    if (key === 'income') return '$' + row.income.toLocaleString();
    return row[key];
  };
  const links = [left, right].map(row => {
    const link = document.createElement('a');
    link.textContent = row.label ?? row.id;
    link.href = '/world?' + new URLSearchParams({ experiment: row.id });
    return link;
  });
  result.replaceChildren(
    `First difference at a shared saved minute · ${minute}. `,
    ...fields.map(key => `${traits[key]} · ${format(left, key)} → ${format(right, key)}. `),
    links[0], ' · ', links[1],
  );
}

function render(result) {
  data = result;
  const { branches, personId, truncated, notices } = result;
  const multiple = branches.length > 1;
  person.value = personId;
  find('coverage').textContent = multiple
    ? `${branches.length} saved branches · ${personId}. Positions show checkpoint depth. Each checkpoint shows its modeled minute.${truncated ? ' The view reached its checkpoint or branch limit.' : ''}`
    : `One saved path for ${personId}. Save additional futures descended from this checkpoint to compare branches.`;
  draw(branches);
  for (const key of ['left', 'right']) {
    find(key).replaceChildren(...branches.map((path, i) => new Option(`${i + 1} · ${path.at(-1).label ?? path.at(-1).id}`, i)));
  }
  find('right').selectedIndex = multiple ? 1 : 0;
  find('comparison').hidden = find('difference').hidden = !multiple;
  compare();
  find('branches').replaceChildren(...branches.map((path, i) => {
    const item = document.createElement('li');
    item.append(`Branch ${i + 1} · `);
    for (const row of path) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${row.label ?? row.id} · Minute ${row.minute}`;
      button.onclick = () => choose(row);
      item.append(button);
    }
    return item;
  }));
  find('notices').replaceChildren(...notices.map(note => {
    const item = document.createElement('li');
    item.textContent = note;
    return item;
  }));
  const checkpoint = new URLSearchParams(location.search).get('checkpoint');
  choose(branches.flat().find(row => row.id === checkpoint) ?? branches[0][0]);
  find('result').hidden = false;
  status.textContent = 'Saved timelines ready.';
}

function load() {
  worker?.terminate();
  find('result').hidden = true;
  status.textContent = 'Reading saved checkpoints…';
  const job = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker = job;
  job.onmessage = ({ data }) => {
    if (job !== worker) return;
    job.terminate();
    if (data.error) status.textContent = data.error;
    else render(data.result);
  };
  job.onerror = () => { if (job !== worker) return; job.terminate(); status.textContent = 'The checkpoint reader could not start.'; };
  job.postMessage({ rootId: root.value, personId: person.value.trim() });
}

form.onsubmit = event => { event.preventDefault(); load(); };
find('left').onchange = find('right').onchange = compare;
try {
  const saves = await listLivingSaves();
  const counts = new Map();
  for (const row of saves) counts.set(row.parentId, (counts.get(row.parentId) ?? 0) + 1);
  saves.sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  root.replaceChildren(...saves.map(row => {
    const count = counts.get(row.id);
    return new Option((row.label ?? row.id) + (count ? ` · ${count} direct forks` : ''), row.id);
  }));
  form.querySelector('button').disabled = !saves.length;
  status.textContent = saves.length ? 'Choose the starting checkpoint.' : 'Save a Living World checkpoint to start a braid.';
  if (saves.some(row => row.id === query.get('experiment'))) {
    root.value = query.get('experiment');
    person.value = query.get('person') ?? '';
    load();
  }
} catch (error) {
  status.textContent = error.message;
  form.querySelector('button').disabled = true;
}
