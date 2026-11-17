/** Public navigation recipe only; never ballot identity, arbitrary text, or an applied legal amendment. */
const ids = /^[A-Za-z0-9_-]{1,80}$/;
const versions = /^[A-Za-z0-9._-]{1,80}$/;
const strengths = [0, .25, .5, .75, 1];
export function parseCivicContext(search) {
  const p = new URLSearchParams(search);
  if (p.get('civicContext') !== '1') return null;
  for (const key of ['civicContext','proposalId','revision','lawId','implementationStrength','seed','population','modelVersion']) {
    if (p.getAll(key).length > 1) return null;
  }
  const number = key => p.has(key) && p.get(key).trim() !== '' ? Number(p.get(key)) : NaN;
  const lawId = number('lawId'), implementationStrength = number('implementationStrength'), seed = number('seed');
  const revision = number('revision'), population = p.has('population') ? number('population') : 24;
  if (![21,22,23,83].includes(lawId) || !strengths.includes(implementationStrength) ||
      (lawId === 21 && implementationStrength !== 1) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff ||
      !Number.isInteger(revision) || revision < 1 || revision > 1e6 || population !== 24 ||
      (p.has('proposalId') && !ids.test(p.get('proposalId'))) ||
      (p.has('modelVersion') && !versions.test(p.get('modelVersion')))) return null;
  return {civicContext: '1', ...(p.has('proposalId') ? {proposalId:p.get('proposalId')} : {}),
    revision, lawId, implementationStrength, seed, population,
    ...(p.has('modelVersion') ? {modelVersion:p.get('modelVersion')} : {})};
}
export function civicContextLink(context, destination = 'civic') {
  const params = new URLSearchParams(Object.entries(context).map(([k,v]) => [k,String(v)]));
  const validated = parseCivicContext(params);
  if (!validated) throw new TypeError('Invalid public civic context');
  const url = new URL(destination === 'hbl' ? 'https://happybearlandia.fly.dev/world/constitution-city.html' : 'https://civic-synthesis.fly.dev/synth');
  for (const [key,value] of Object.entries(validated)) url.searchParams.set(key,String(value));
  return url.href;
}
