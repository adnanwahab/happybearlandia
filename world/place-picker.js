// Authored invitations over real geography; these hooks are not model results.
export const PLACES = [
  ['museum','Houston Museum District',29.7216,-95.3895,'What could a greener neighborhood become?','#dc975b'],
  ['coast','Galveston coast',29.3013,-94.7977,'Can this neighborhood weather the next storm?','#73bfc5'],
  ['downtown','Downtown Houston',29.752,-95.358,'Who thrives in a city that keeps growing?','#889ecb'],
  ['gulfton','Gulfton, Houston',29.7286,-95.4746,'Can a better bus ride change a day?','#d6b966'],
  ['village','East Village, New York',40.7265,-73.9815,'Is there room for everyone on this block?','#c58383'],
  ['tokyo','Shibuya, Tokyo',35.6595,139.7005,'What keeps a busy neighborhood moving?','#9cae91'],
].map(([id,name,lat,lng,hook,color])=>({id,name,lat,lng,hook,color,seed:`postcard-v1:${id}`}));
export function placeURL(place, current) {
  if(!Number.isFinite(place.lat)||Math.abs(place.lat)>85||!Number.isFinite(place.lng)||Math.abs(place.lng)>180)throw new Error('Choose latitude between −85 and 85 and longitude between −180 and 180.');
  const url=new URL('/world',current);
  const renderer=new URL(current).searchParams.get('renderer');
  if(renderer)url.searchParams.set('renderer',renderer);
  for(const [key,value]of Object.entries({lat:place.lat,lng:place.lng,seed:place.seed||`place-v1:${place.lat.toFixed(4)},${place.lng.toFixed(4)}`,arrival:'1'}))url.searchParams.set(key,String(value));
  return url.href;
}
function illustration(p,i){return `<svg viewBox="0 0 320 140" aria-hidden="true"><rect width="320" height="140" fill="${p.color}"/><circle cx="265" cy="32" r="20" fill="#ffe8b2"/><path d="M0 110 Q90 55 170 108 T320 90 V140 H0" fill="#45675d"/>${Array.from({length:7},(_,n)=>`<rect x="${12+n*43}" y="${60+(n+i)%3*12}" width="30" height="70" fill="${n%2?'#f3dfb7':'#405968'}"/><path d="M${17+n*43} 86h19m-19 12h19" stroke="#e4b758" stroke-width="4"/>`).join('')}${i===1?'<path d="M0 118 Q60 103 120 120 T320 116 V140 H0" fill="#4d9da9"/>':''}</svg>`;}
export function mountPlacePicker(){
  const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/world/place-picker.css';document.head.append(sheet);
  const dialog=document.createElement('dialog');dialog.className='place-picker';dialog.setAttribute('aria-labelledby','place-picker-title');
  dialog.innerHTML=`<header><div><small>YOUR NEXT NEIGHBORHOOD</small><h1 id="place-picker-title">Choose a place</h1><p>Six places. A thousand possible futures.</p></div><button type="button" data-close aria-label="Close place picker">Close ×</button></header><div class="postcards">${PLACES.map((p,i)=>`<button type="button" data-place="${p.id}">${illustration(p,i)}<strong>${p.name}</strong><span>${p.hook}</span></button>`).join('')}</div><p>Illustrated invitations · real geography, synthetic residents and outcomes.</p><details><summary>Somewhere else</summary><p>Pick an approximate spot on the world map, or search for an address or city.</p><button type="button" class="pin-map" aria-label="World map: click to drop a pin"><svg viewBox="0 0 720 240" preserveAspectRatio="none" aria-hidden="true"><rect width="720" height="240" fill="#233f53"/><path d="M65 40L130 25 205 55 170 90 130 100 150 140 105 100ZM180 120L240 140 220 215 195 180ZM310 50L380 30 460 40 550 25 660 75 590 120 510 100 460 130 410 80 365 85 400 145 365 200 330 130ZM570 165L635 155 660 195 600 205Z" fill="#91b29b"/></svg><span class="pin" hidden>📍</span></button><p data-pin-status role="status"></p><button type="button" data-visit hidden>Visit pinned place</button><form data-search><label>Address or city <input name="query" required minlength="2" maxlength="160"></label><button>Search</button></form><div data-results role="status"></div><p>Search: OpenStreetMap contributors / Photon.</p><details><summary>Use my location</summary><p>Only if you agree: your browser will request location access. Your coordinates will appear in the world URL.</p><button type="button" data-consent>Agree and use my location</button></details><details><summary>Precise location</summary><form data-precise><label>Latitude <input name="lat" type="number" min="-85" max="85" step="any" required></label><label>Longitude <input name="lng" type="number" min="-180" max="180" step="any" required></label><button>Visit coordinates</button></form></details></details><p data-error role="alert"></p>`;
  document.body.append(dialog);
  const error=dialog.querySelector('[data-error]');
  const visit=p=>{try{location.assign(placeURL(p,location.href));}catch(e){error.textContent=e.message;}};
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  for(const button of dialog.querySelectorAll('[data-place]'))button.onclick=()=>visit(PLACES.find(p=>p.id===button.dataset.place));
  let pin;const map=dialog.querySelector('.pin-map'),go=dialog.querySelector('[data-visit]');
  map.onclick=e=>{const r=map.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));pin={lat:85-y*170,lng:x*360-180};const marker=map.querySelector('.pin');marker.hidden=false;marker.style.left=`${x*100}%`;marker.style.top=`${y*100}%`;dialog.querySelector('[data-pin-status]').textContent=`Approximate pin: ${pin.lat.toFixed(2)}, ${pin.lng.toFixed(2)}`;go.hidden=false;};go.onclick=()=>visit(pin);
  dialog.querySelector('[data-precise]').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);visit({lat:Number(f.get('lat')),lng:Number(f.get('lng'))});};
  let generation=0;
  dialog.querySelector('[data-search]').onsubmit=async e=>{e.preventDefault();const id=++generation,results=dialog.querySelector('[data-results]');results.textContent='Searching…';try{const response=await fetch('/api/date-places?q='+encodeURIComponent(new FormData(e.target).get('query')),{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Search unavailable. Try a pin or preset.');const data=await response.json();if(id!==generation)return;results.replaceChildren();for(const place of data.places||[]){const b=document.createElement('button');b.type='button';b.textContent=place.name;b.onclick=()=>visit(place);results.append(b);}if(!results.children.length)results.textContent='No places found. Try a city name or a pin.';}catch(e){if(id===generation)results.textContent=e.message;}};
  dialog.querySelector('[data-consent]').onclick=()=>{if(!navigator.geolocation){error.textContent='Location unavailable. Choose a postcard or pin.';return;}navigator.geolocation.getCurrentPosition(p=>visit({lat:p.coords.latitude,lng:p.coords.longitude}),()=>{error.textContent='Location access unavailable. Choose a postcard or pin.';},{timeout:10000});};
  return {open(){error.textContent='';dialog.showModal();}};
}
