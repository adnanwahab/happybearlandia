/** All coefficients are illustrative assumptions, not calibrated city forecasts. */
export const VERSION = 'city-systems.1.1.0';
export const CONTRACTS = Object.freeze(Object.fromEntries(['CityState','SystemState','MarketProposal','MarketResolution','CapacityConstraint','ResourceFlow','CityObservation','SystemEvent'].map(id => [id, `${id}.v1`])));
export const housingProjectBuildingId = projectId => `building-${projectId}`;
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const sum = (rows, fn) => rows.reduce((n, row) => n + fn(row), 0);
export function draw(seed, ...keys) {
  let h = seed >>> 0;
  for (const c of keys.join(':')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}
export class CapacityRegistry {
  constructor() { this.rows = []; this.used = new Map(); }
  register({resource, districtId = '*', time, capacity}) {
    if (!Number.isFinite(capacity) || capacity < 0) throw new Error('Invalid capacity');
    const key = `${resource}:${districtId}:${time}`;
    if (this.rows.some(row => row.key === key)) throw new Error('Duplicate capacity');
    this.rows.push({schemaVersion: CONTRACTS.CapacityConstraint, key, resource, districtId, time, capacity});
  }
  query({resource, districtId = '*', time}) {
    const row = this.rows.find(r => r.resource === resource && r.districtId === districtId && r.time === time);
    return row ? {...row, used: this.used.get(row.key) || 0, available: row.capacity - (this.used.get(row.key) || 0)} : null;
  }
  reserve(query, amount) {
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid reservation');
    const row = this.query(query);
    if (!row || row.available + 1e-9 < amount) return false;
    this.used.set(row.key, row.used + amount); return true;
  }
  reserveAll(requests) {
    const previous = new Map(this.used);
    for (const {amount, ...query} of requests) if (!this.reserve(query, amount)) { this.used = previous; return false; }
    return true;
  }
}
export function validateState(s) {
  if (s.schemaVersion !== CONTRACTS.CityState) throw new Error('Unsupported CityState version');
  for (const collection of ['districts','parcels','buildings','units','households','workers','businesses','jobs','links','facilities','utilities','projects','policies']) {
    if (!Array.isArray(s[collection])) throw new Error(`Missing ${collection}`);
    const ids = new Set();
    for (const row of s[collection]) {
      if (typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error(`Duplicate/missing ${collection} ID`);
      ids.add(row.id);
      for (const [key,value] of Object.entries(row)) if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`Non-finite ${collection}.${key}`);
    }
  }
  if(!Number.isInteger(s.month)||s.month<0||!Number.isInteger(s.seed)||s.seed<0||s.seed>4294967295)throw new Error('Invalid clock or seed');
  if(!s.districts.length||s.districts.length>32)throw new Error('Invalid district count');
  if(!s.parameters||!s.finance||!s.systems||!Array.isArray(s.shocks))throw new Error('Missing city parameters/finance/systems/shocks');
  for(const key of ['contractors','labor','materials','equipment','permits','administration','interestRate','constructionCost','annualGrowth'])if(!Number.isFinite(s.parameters[key])||(key!=='annualGrowth'&&s.parameters[key]<0))throw new Error(`Invalid parameter ${key}`);
  for(const key of ['balance','debt','maxDebt','revenue','operatingExpense','capitalExpense'])if(!Number.isFinite(s.finance[key]))throw new Error(`Invalid finance ${key}`);
  if(s.units.some(u=>!Number.isFinite(u.rent)||!Number.isInteger(u.bedrooms)||u.bedrooms<0||!['available','occupied','reserved','under renovation','under construction'].includes(u.status)))throw new Error('Invalid housing inventory');
  if(s.households.some(h=>!Number.isFinite(h.income)||h.income<0||!Number.isFinite(h.otherIncome)||!Number.isInteger(h.size)||h.size<1||!Number.isFinite(h.savings)||!Number.isFinite(h.age)||!Number.isFinite(h.leaseUntil)))throw new Error('Invalid household');
  if(s.links.some(l=>!Number.isFinite(l.capacity)||l.capacity<0||!Number.isFinite(l.freeTime)||l.freeTime<=0))throw new Error('Invalid link capacity/time');
  if(s.utilities.some(u=>!Number.isFinite(u.capacity)||u.capacity<0)||s.facilities.some(f=>!Number.isFinite(f.capacity)||f.capacity<0))throw new Error('Invalid service capacity');
  if(s.projects.some(p=>!Number.isInteger(p.duration)||p.duration<1||!Number.isFinite(p.progress)||p.progress<0||!Number.isInteger(p.units)||p.units<0))throw new Error('Invalid project');
  const districts = new Set(s.districts.map(d=>d.id));
  for (const rows of [s.parcels,s.buildings,s.units,s.households,s.workers,s.businesses,s.jobs,s.facilities,s.utilities,s.projects]) for(const row of rows) if(!districts.has(row.districtId)) throw new Error('Unknown district');
  for(const link of s.links)if(!districts.has(link.from)||!districts.has(link.to))throw new Error('Invalid network endpoint');
  const buildings=new Set(s.buildings.map(b=>b.id));for(const u of s.units)if(!buildings.has(u.buildingId))throw new Error('Unknown housing building');
  const households = new Map(s.households.map(h=>[h.id,h])), occupied = new Set();
  for (const u of s.units) {
    if (u.rent < 0 || u.rent > 50000) throw new Error('Rent stability bound exceeded');
    if (u.householdId) {
      if (occupied.has(u.householdId) || households.get(u.householdId)?.unitId !== u.id || u.status !== 'occupied') throw new Error('Housing assignment invariant');
      occupied.add(u.householdId);
    } else if(u.status === 'occupied') throw new Error('Occupied unit has no household');
  }
  for (const h of s.households) if(h.unitId && !s.units.some(u=>u.id===h.unitId && u.householdId===h.id)) throw new Error('Household unit invariant');
  const workers = new Map(s.workers.map(w=>[w.id,w])), filled = new Set();
  for(const j of s.jobs) if(j.workerId) {
    if(filled.has(j.workerId) || workers.get(j.workerId)?.jobId!==j.id) throw new Error('Job assignment invariant');
    filled.add(j.workerId);
  }
  for(const w of s.workers) if(w.jobId && !s.jobs.some(j=>j.id===w.jobId && j.workerId===w.id)) throw new Error('Worker job invariant');
  if (s.households.some(h=>h.size<1) || s.finance.debt<0 || !Number.isFinite(s.finance.balance)) throw new Error('City stability invariant');
  if(s.residents!==undefined){
    if(!Array.isArray(s.residents)||new Set(s.residents.map(r=>r.id)).size!==s.residents.length)throw new Error('Invalid resident identity');
    for(const r of s.residents){
      if(typeof r.id!=='string'||!r.id||!['active','departed'].includes(r.status)||!Number.isInteger(r.sinceMonth)||r.sinceMonth<0||r.sinceMonth>s.month||!Array.isArray(r.memories)||!Array.isArray(r.relationships)||!Array.isArray(r.goals)||r.goals.length!==2||!r.needs||['housing','livelihood','social'].some(k=>!Number.isFinite(r.needs[k])||r.needs[k]<0||r.needs[k]>100))throw new Error('Invalid resident state');
      if(r.status==='active'&&(!households.has(r.householdId)||!workers.has(r.workerId)))throw new Error('Unknown resident household/worker');
      for(const tie of r.relationships)if(!s.residents.some(other=>other.id===tie.residentId)||!Number.isFinite(tie.strength)||tie.strength<0||tie.strength>100)throw new Error('Invalid resident relationship');
      for(const memory of r.memories)if(!Number.isInteger(memory.month)||memory.month<r.sinceMonth||memory.month>s.month||typeof memory.eventId!=='string'||typeof memory.ruleId!=='string')throw new Error('Invalid resident memory');
    }
  }
  return true;
}
