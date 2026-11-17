// Authored northern-style 360-day calendar; no climate or ecology inference.
export const SEASONS = ['spring','summer','autumn','winter'];
const palettes = [[0x90ae66,0xc5a3b7,0x67854a],[0x304c29,0x4c6536,0x284830],[0xc18a37,0xa95131,0x967137],[0xabb7b2,0x859a91,0xc5cfca]];
export function seasonalStyle(minute, override='auto', seed=0) {
  if(override==='off'||(override==='auto'&&!Number.isFinite(minute)))return null;
  const index=override==='auto'?Math.floor((((Math.floor(minute/1440)%360)+360)%360)/90):SEASONS.indexOf(override);
  if(index<0)throw new RangeError('Unknown season');
  // Independent integer hash: never consume the model RNG.
  let hash=2166136261;for(const c of String(seed))hash=Math.imul(hash^c.charCodeAt(0),16777619);
  return {season:SEASONS[index],color:palettes[index][(hash>>>0)%3],scale:index===3?.58:1,propColor:palettes[index][0]};
}
