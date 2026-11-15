// Authored aesthetics only. No City model, clock, entity or RNG dependencies.
export const VERSION = 'neighborhood-palette/1';
export const STYLES = Object.freeze({
  original: Object.freeze({ wall: '#b8c7c3', leaf: '#478564', sky: '#b9d8e3', window: '#f8e6ae' }),
  cozy: Object.freeze({ wall: '#dba883', leaf: '#76924c', sky: '#f2d4b9', window: '#ffdb80' }),
  futuristic: Object.freeze({ wall: '#8fbfdd', leaf: '#439e99', sky: '#242f55', window: '#a6f5ee' }),
  whimsical: Object.freeze({ wall: '#d4a4d9', leaf: '#53b8a0', sky: '#e2d7fa', window: '#fff0a3' }),
});
export const DEFAULT = Object.freeze({ version: VERSION, architecture: 'original', vegetation: 'original', lighting: 'original' });
export function recipe(value) {
  if (!value || value.version !== VERSION || Object.keys(value).sort().join() !== Object.keys(DEFAULT).sort().join()) throw new Error('Unsupported render recipe.');
  for (const key of ['architecture', 'vegetation', 'lighting']) if (!Object.hasOwn(STYLES, value[key])) throw new Error('Unavailable aesthetic preset.');
  return { version: VERSION, architecture: value.architecture, vegetation: value.vegetation, lighting: value.lighting };
}
export function serialize(value) { return JSON.stringify(recipe(value)); }
export function colors(value) {
  const r = recipe(value);
  return { wall: STYLES[r.architecture].wall, leaf: STYLES[r.vegetation].leaf, sky: STYLES[r.lighting].sky, window: STYLES[r.lighting].window };
}
export function scene(value) {
  const c = colors(value);
  // Fixed authored geometry; decorative trees imply no ecological outcomes.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240" role="img" aria-label="Authored cosmetic neighborhood preview"><rect width="480" height="240" fill="${c.sky}"/><path d="M0 194H480V240H0Z" fill="#52675e"/>${[40,180,320].map((x,i)=>`<rect x="${x}" y="${90-i*12}" width="85" height="${104+i*12}" rx="4" fill="${c.wall}" stroke="#263f40" stroke-width="3"/>${[0,1,2].map(j=>`<rect x="${x+15+j*22}" y="120" width="12" height="22" fill="${c.window}"/>`).join('')}<rect x="${x+34}" y="160" width="20" height="34" fill="#354d50"/><path d="M${x-8} ${90-i*12}l50-30 50 30Z" fill="#52616d"/>`).join('')}${[145,285,435].map(x=>`<path d="M${x} 210v-50" stroke="#644a37" stroke-width="7"/><circle cx="${x}" cy="160" r="23" fill="${c.leaf}" stroke="#263f40" stroke-width="2"/>`).join('')}</svg>`;
}
