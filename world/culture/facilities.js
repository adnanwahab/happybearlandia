import { canonicalId } from '../../shared/causality/index.js';
export const FACILITIES = Object.freeze([
  ['flower','Botanical garden','/tools/flower','Fictional botanical environment'],
  ['ai-seinfeld','Comedy theater','/tools/ai-seinfeld','Fictional characters and stories'],
  ['quote-carousel','Museum of ideas','/tools/quote-carousel','Curated quotations; interpretations are annotations'],
  ['lumen','Architecture studio','/tools/lumen/','Loaded geometry is separate from design annotations'],
].map(([experienceId,label,route,evidence]) => Object.freeze({experienceId,label,route,evidence,id:canonicalId('facility','culture',experienceId)})));
export function destination(route, search) {
  const url = new URL(route, 'https://hbl.invalid');
  for (const [key,value] of new URLSearchParams(search)) url.searchParams.append(key,value);
  return url.pathname + url.search + url.hash;
}
export function annotationKey(facility, search) {
  const params = new URLSearchParams(search);
  return JSON.stringify(['hbl-culture-v1',facility,...['universeId','worldId','scenarioId','experimentId','runId','branchId','tick','time','entityId'].map(k=>params.get(k))]);
}
