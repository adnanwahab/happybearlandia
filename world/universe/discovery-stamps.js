// Authored cosmetic collectibles. These IDs never identify simulation entities.
export const STAMPS = Object.freeze([
  Object.freeze({id:'petal', name:'A quiet petal', route:'/tools/flower', hint:'Look near the breeze in Flower.'}),
  Object.freeze({id:'quotation', name:'Between the lines', route:'/tools/quote-carousel', hint:'Look beyond the words in Quote Carousel.'}),
]);
export const STAMP_KEY = 'hbl-discovery-stamps-v1';
export function decodeStamps(raw) {
  try {
    const value = JSON.parse(raw);
    return new Set(Array.isArray(value) ? value.filter(id => STAMPS.some(stamp => stamp.id === id)) : []);
  } catch { return new Set(); }
}
export function createStampBook(storage) {
  let saved = new Set(), persistent = true;
  try { saved = decodeStamps(storage.getItem(STAMP_KEY)); } catch { persistent = false; }
  function write(reset = false) {
    try {
      if (reset) storage.removeItem(STAMP_KEY);
      else storage.setItem(STAMP_KEY, JSON.stringify([...saved]));
      persistent = true;
    } catch { persistent = false; }
  }
  return {
    has: id => saved.has(id),
    get persistent() { return persistent; },
    collect(id) { if (STAMPS.some(stamp => stamp.id === id)) { saved.add(id); write(); } },
    reset() { saved.clear(); write(true); },
  };
}
