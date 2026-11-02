// All archetype differences are data. These are illustrative starting assumptions.
export const ARCHETYPES = {
  'local-retail': { label: 'Local retail / stand', scale: 'day', constraint: 'inventory', price: 2, cost: .65, traffic: 260, capacity: 180, cash: 500, rent: 8, wage: 15, spoilage: .65, hours: 8, unit: 'cup', recurring: false },
  'physical-product': { label: 'Physical consumer product', scale: 'month', constraint: 'inventory', price: 28, cost: 10.4, traffic: 2600, capacity: 2500, cash: 100000, rent: 1200, wage: 2100, spoilage: .02, hours: 160, unit: '12-pack', recurring: false },
  subscription: { label: 'Subscription / SaaS', scale: 'month', constraint: 'support', price: 99, cost: 8, traffic: 1600, capacity: 300, cash: 100000, rent: 600, wage: 4000, spoilage: 0, hours: 160, unit: 'subscription', recurring: true },
  services: { label: 'Services', scale: 'day', constraint: 'labor', price: 60, cost: 12, traffic: 35, capacity: 12, cash: 3000, rent: 20, wage: 100, spoilage: 0, hours: 8, unit: 'job', recurring: false },
  marketplace: { label: 'Marketplace', scale: 'month', constraint: 'sellers', price: 40, cost: 2, traffic: 4000, capacity: 2000, cash: 80000, rent: 500, wage: 3000, spoilage: 0, hours: 160, unit: 'match', recurring: false },
  media: { label: 'Media / creator', scale: 'month', constraint: 'attention', price: 5, cost: .3, traffic: 12000, capacity: 10000, cash: 10000, rent: 100, wage: 1200, spoilage: 0, hours: 160, unit: 'paid view', recurring: false },
  manufacturing: { label: 'Manufacturing', scale: 'month', constraint: 'inventory', price: 18000, cost: 10000, traffic: 65, capacity: 12, cash: 500000, rent: 5000, wage: 4500, spoilage: 0, hours: 160, unit: 'unit', recurring: false },
  project: { label: 'Project business', scale: 'month', constraint: 'labor', price: 12000, cost: 3000, traffic: 30, capacity: 8, cash: 120000, rent: 1200, wage: 5000, spoilage: 0, hours: 160, unit: 'project', recurring: false },
};
export const SEGMENTS = [
  { id: 'value', label: 'Value seekers', share: .45, budget: 1.05, sensitivity: 2.8, quality: 1.1, patience: 4 },
  { id: 'regular', label: 'Everyday buyers', share: .35, budget: 1.7, sensitivity: 1.8, quality: 1.8, patience: 7 },
  { id: 'premium', label: 'Quality enthusiasts', share: .2, budget: 2.8, sensitivity: 1.2, quality: 2.8, patience: 10 },
];
export const CHANNELS = [
  { id: 'social', label: 'Paid social', reach: 65, saturation: 1200, conversion: .018 },
  { id: 'creators', label: 'Creators', reach: 90, saturation: 1800, conversion: .024 },
  { id: 'local', label: 'Local / referrals', reach: 35, saturation: 400, conversion: .035 },
];
export const EVENTS = [
  { id: 'festival', label: 'Festival / demand boom', traffic: 1.65, cost: 1, warning: 'More traffic is expected next period.' },
  { id: 'roadworks', label: 'Road works / weak market', traffic: .65, cost: 1, warning: 'Plan for reduced demand next period.' },
  { id: 'shortage', label: 'Supplier shortage', traffic: 1, cost: 1.5, warning: 'Suppliers expect input costs to rise 50%.' },
  { id: 'viral', label: 'Creator mention', traffic: 1.35, cost: 1, warning: 'A creator feature is scheduled.' },
];
export function createDefinition(archetype = 'local-retail', overrides = {}) {
  const a = ARCHETYPES[archetype];
  if (!a) throw new Error('Unknown archetype');
  return {
    schemaVersion: 'business-def.v1', id: 'my-business', name: archetype === 'local-retail' ? 'Little Lemon Stand' : 'My business', description: '', archetype, scale: a.scale,
    unit: a.unit, price: a.price, unitCost: a.cost, quality: 75, startingCash: a.cash, capacity: a.capacity, baseTraffic: a.traffic,
    rent: a.rent, wage: a.wage, repeatRate: .24, churnRate: .06, startingAwareness: .18, growth: .01,
    fulfillment: a.constraint, leadTime: archetype === 'manufacturing' ? 2 : 0, takeRate: .2,
    inputs: [{ id: 'stock', unit: a.unit, cost: a.cost, quality: .8 }],
    recipe: { knobs: [], batchYield: 1, ideal: {} }, production: { batchSize: 1, minutes: 1, hours: a.hours },
    perishability: { per: 'period', rate: a.spoilage }, referencePrice: { min: a.price * .5, typical: a.price, max: a.price * 2 },
    demand: { weatherWeight: archetype === 'local-retail' ? .5 : 0, seasonality: [1,1,1,1,1,1,1,1,1,1,1,1] },
    segments: SEGMENTS.map(s => ({ ...s, affinity: 1 })), channels: CHANNELS.map(c => ({ ...c })), unlock: { tier: 'stand' },
    ...overrides,
  };
}
export const EXAMPLES = [
  { name: 'Lemonade stand', text: 'Fresh lemonade sold from a neighborhood stand for $2 a cup.', archetype: 'local-retail' },
  { name: 'Yuzu drink', text: 'A premium sparkling yuzu energy drink for gamers, sold online in 12-packs for $28.', archetype: 'physical-product' },
  { name: 'Accounting SaaS', text: 'Accounting software subscription for freelancers at $99 per month.', archetype: 'subscription' },
  { name: 'Landscaping', text: 'A local landscaping service charging $60 per job.', archetype: 'services' },
];
