/** mountVehicleInspector(container,{onClose?}) ->
 * {select(vehicle|null),update(vehicle),destroy()}.
 * Current traffic is decorative. Cabin occupants are anonymous illustrations,
 * not resident/trip records. No tracked passenger, purpose or destination claim.
 * createTrafficVehicleMetadata(instanceId,{color?,routeIndex?}) is DOM-free and
 * stable for that instance in the loaded neighborhood. No random identities.
 */
const SEATS = [
  { id: "front-left", label: "Driver seat", role: "Driver", x: 84, y: 184 },
  { id: "front-right", label: "Front passenger seat", role: "Front passenger", x: 216, y: 184 },
  { id: "rear-left", label: "Rear left seat", role: "Rear passenger", x: 84, y: 338 },
  { id: "rear-right", label: "Rear right seat", role: "Rear passenger", x: 216, y: 338 },
];
const PALETTE = ["#71c7be", "#e7b77a", "#9eaff0", "#d5a0b9"];
const escape = value => String(value ?? "").replace(/[&<>"']/g, letter => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[letter]);
function colorHex(value) { if (Number.isInteger(value) && value >= 0 && value <= 0xffffff) return `#${value.toString(16).padStart(6, "0")}`; return /^#[a-f\d]{6}$/i.test(value || "") ? value : "#8cadbd"; }
export function createTrafficVehicleMetadata(instanceId, { color, routeIndex = 0 } = {}) {
  if (!Number.isInteger(instanceId) || instanceId < 0) throw new RangeError("Vehicle instanceId must be a nonnegative integer.");
  const id = `traffic-car-${String(instanceId).padStart(4, "0")}`, count = 1 + instanceId % 4;
  const occupants = SEATS.slice(0, count).map((seat, index) => Object.freeze({ id: `illustration-${id}-${seat.id}`, seatId: seat.id, role: seat.role, illustrative: true, color: PALETTE[(instanceId + index) % PALETTE.length] }));
  return Object.freeze({ kind: "vehicle", id, instanceId, label: `Car ${String(instanceId + 1).padStart(3, "0")}`, color: colorHex(color), routeIndex: Number.isInteger(routeIndex) ? routeIndex : 0, occupantProvenance: "illustrative", trafficProvenance: "decorative-traffic", seats: 4, occupants: Object.freeze(occupants) });
}
export function vehicleIllustrativeOccupants(vehicle) {
  const source = Array.isArray(vehicle?.occupants) ? vehicle.occupants : [];
  // Only seat occupancy and validated illustration color are consumed. Personal
  // names, identities, destinations and arbitrary supplied text are never shown.
  return SEATS.flatMap(seat => { const record = source.find(person => person?.seatId === seat.id); return record ? [{ seatId: seat.id, label: seat.label, role: seat.role, illustrative: true, color: colorHex(record.color) }] : []; });
}
export function renderVehicleCabin(vehicle, selectedSeat = "front-left") {
  const occupants = vehicleIllustrativeOccupants(vehicle), paint = colorHex(vehicle?.color);
  return `<svg class="vi-cabin" viewBox="0 0 300 510" role="img" aria-label="Illustrative top-down car cabin with ${occupants.length} seated anonymous occupants, not tracked resident passengers"><title>Roof removed · illustrative cabin and occupants</title><defs><linearGradient id="vi-body-paint" x2="1" y2="1"><stop stop-color="${paint}"/><stop offset="1" stop-color="#304b57"/></linearGradient></defs><rect x="14" y="90" width="18" height="83" rx="7" fill="#111c22"/><rect x="268" y="90" width="18" height="83" rx="7" fill="#111c22"/><rect x="14" y="340" width="18" height="83" rx="7" fill="#111c22"/><rect x="268" y="340" width="18" height="83" rx="7" fill="#111c22"/><path d="M64 25 Q150 0 236 25 Q269 42 269 110 L269 409 Q268 469 231 487 L69 487 Q31 469 31 409 L31 110 Q31 42 64 25Z" fill="url(#vi-body-paint)" stroke="#b6d0d6" stroke-width="2"/><path d="M65 63 Q150 35 235 63 L245 110 L55 110Z" fill="#b5e0e6" opacity=".8"/><path d="M55 422 L245 422 L231 457 L69 457Z" fill="#93c2ca" opacity=".5"/><rect x="45" y="118" width="210" height="294" rx="25" fill="#14242e" stroke="#7f9ca5"/><rect x="142" y="150" width="16" height="211" rx="6" fill="#344b56"/><path d="M52 130 H248" stroke="#a4b1ac" stroke-width="14"/><circle cx="85" cy="130" r="19" fill="none" stroke="#e0e4d7" stroke-width="5"/><path d="M69 130 H101 M85 131 V146" stroke="#e0e4d7" stroke-width="3"/>${SEATS.map(seat => { const person = occupants.find(record => record.seatId === seat.id), active = selectedSeat === seat.id; return `<g class="vi-seat ${active ? "vi-seat-selected" : ""}" data-vi-seat="${seat.id}" role="button" tabindex="0" aria-label="${seat.label}: ${person ? "illustrative occupant" : "empty illustration seat"}"><rect x="${seat.x - 38}" y="${seat.y - 26}" width="76" height="100" rx="18" fill="${active ? "#466a70" : "#314851"}" stroke="${active ? "#83eed7" : "#789095"}" stroke-width="${active ? 3 : 1}"/><rect x="${seat.x - 27}" y="${seat.y - 38}" width="54" height="24" rx="9" fill="#596e70"/>${person ? `<g class="vi-occupant"><path d="M${seat.x - 12} ${seat.y + 35} L${seat.x - 18} ${seat.y + 63} M${seat.x + 12} ${seat.y + 35} L${seat.x + 18} ${seat.y + 63}" stroke="#a9bcc1" stroke-width="12" stroke-linecap="round"/><ellipse cx="${seat.x}" cy="${seat.y + 18}" rx="25" ry="32" fill="${person.color}"/><path d="M${seat.x - 22} ${seat.y + 8} L${seat.x - 29} ${seat.y + 30} M${seat.x + 22} ${seat.y + 8} L${seat.x + 29} ${seat.y + 30}" stroke="${person.color}" stroke-width="10" stroke-linecap="round"/><circle cx="${seat.x}" cy="${seat.y - 12}" r="17" fill="#d6b8a1"/><path d="M${seat.x - 28} ${seat.y - 18} L${seat.x + 20} ${seat.y + 42}" stroke="#e3eadc" stroke-width="4" opacity=".9"/></g>` : `<text x="${seat.x}" y="${seat.y + 28}" text-anchor="middle" fill="#8fa7aa" font-size="11">EMPTY</text>`}</g>`; }).join("")}<text x="150" y="40" text-anchor="middle" fill="#122a32" font-size="12" font-weight="700">FRONT ↑</text><text x="150" y="479" text-anchor="middle" fill="#d9eceb" font-size="10">ROOF REMOVED · ILLUSTRATION</text></svg>`;
}

export function mountVehicleInspector(container, { onClose } = {}) {
  if (!container?.ownerDocument) throw new TypeError("Vehicle inspector needs a DOM container.");
  const doc = container.ownerDocument, root = doc.createElement("aside"); root.className = "vehicle-inspector"; root.dataset.testid = "vehicle-inspector"; root.hidden = true; root.setAttribute("aria-label", "Selected car interior");
  const stylesheet = doc.createElement("link"); stylesheet.rel = "stylesheet"; stylesheet.href = new URL("./minimap.css", import.meta.url).href; root.append(stylesheet);
  const content = doc.createElement("div"); root.append(content); container.append(root);
  let vehicle = null, seatId = "front-left", destroyed = false, returnFocus = null;
  const format = value => typeof value === "number" && Number.isFinite(value) ? Math.round(value).toLocaleString() : "unavailable";
  function render() {
    if (!vehicle || destroyed) return;
    const occupants = vehicleIllustrativeOccupants(vehicle), seat = SEATS.find(record => record.id === seatId) || SEATS[0], occupied = occupants.some(person => person.seatId === seat.id);
    content.innerHTML = `<header class="vi-header"><div><p>VISUAL TRAFFIC</p><h2>${escape(vehicle.label || vehicle.id || "Selected car")}</h2></div><button type="button" data-vi-close aria-label="Close car interior">×</button></header><div class="vi-truth"><strong>Illustrative cabin · ${occupants.length} seated illustrations</strong><p>These are not tracked resident passengers. This car is decorative traffic; no person, trip purpose or destination is assigned to it.</p></div><div class="vi-layout">${renderVehicleCabin(vehicle, seatId)}<div class="vi-details"><h3>Inside this illustration</h3><div class="vi-seat-buttons">${SEATS.map(record => `<button type="button" data-vi-seat="${record.id}" aria-pressed="${record.id === seat.id}">${record.label}<small>${occupants.some(person => person.seatId === record.id) ? "Illustrative occupant" : "Empty"}</small></button>`).join("")}</div><p class="vi-seat-detail" role="status"><b>${seat.label}</b> · ${occupied ? "anonymous seated illustration" : "empty illustration seat"}. ${occupied ? "No real resident identity or journey is associated with this avatar." : "Seat layout is a visual example, not a transport capacity model."}</p><dl><dt>Visual instance</dt><dd>${escape(vehicle.id || "not recorded")}</dd><dt>Local position</dt><dd data-vi-position>E ${format(vehicle.position?.x)} m · N ${format(-vehicle.position?.z)} m</dd><dt>Activity</dt><dd data-vi-active>${vehicle.active === false ? "Hidden by current traffic/density settings" : "Decorative route animation"}</dd></dl></div></div>`;
  }
  function close() { if (destroyed) return; vehicle = null; root.hidden = true; onClose?.(); if (returnFocus?.isConnected) returnFocus.focus?.({ preventScroll: true }); }
  function chooseSeat(id) { if (!SEATS.some(seat => seat.id === id)) return; seatId = id; render(); content.querySelector(`button[data-vi-seat="${id}"]`)?.focus({ preventScroll: true }); }
  function click(event) { if (event.target.closest("[data-vi-close]")) { close(); return; } const seat = event.target.closest("[data-vi-seat]"); if (seat) chooseSeat(seat.dataset.viSeat); }
  function key(event) { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } else if (event.target.matches("g[data-vi-seat]") && ["Enter", " "].includes(event.key)) { event.preventDefault(); chooseSeat(event.target.dataset.viSeat); } }
  root.addEventListener("click", click); root.addEventListener("keydown", key);
  return { select(next) { if (destroyed) return; if (!next) { vehicle = null; root.hidden = true; return; } returnFocus = doc.activeElement; vehicle = next; seatId = "front-left"; root.hidden = false; render(); root.querySelector("[data-vi-close]")?.focus({ preventScroll: true }); }, update(next) { if (destroyed || !vehicle || !next || vehicle.id !== next.id) return; vehicle = next; const position = root.querySelector("[data-vi-position]"); if (position) position.textContent = `E ${format(vehicle.position?.x)} m · N ${format(-vehicle.position?.z)} m`; const activity = root.querySelector("[data-vi-active]"); if (activity) activity.textContent = vehicle.active === false ? "Hidden by current traffic/density settings" : "Decorative route animation"; }, destroy() { destroyed = true; root.removeEventListener("click", click); root.removeEventListener("keydown", key); root.remove(); } };
}
