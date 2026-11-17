import {createShareURL, parseShareURL} from './share/index.js';

export const RECENT_KEY = 'hbl.future-machine.recent.v1';
const base = 'https://local.invalid/world/future-machine.html';

// Reuse the replay validator, but never persist the page URL or unrelated data.
export function recentContext(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'experimentId,month,recipe')
    throw new Error('Saved comparison is invalid or expired. Clear it and run a new comparison.');
  return parseShareURL(createShareURL(value, base));
}

export function readRecent(storage) {
  const raw = storage.getItem(RECENT_KEY);
  if (raw === null) return null;
  if (raw.length > 4096) throw new Error('Saved comparison is invalid or expired. Clear it and run a new comparison.');
  return recentContext(JSON.parse(raw));
}

export function saveRecent(storage, context) {
  storage.setItem(RECENT_KEY, JSON.stringify(recentContext(context)));
}

export function clearRecent(storage) {
  storage.removeItem(RECENT_KEY);
}
