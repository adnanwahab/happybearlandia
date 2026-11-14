/** Canonical deployed Civic API; explicit operator routing remains authoritative. */
export function civicProviderUrl(env = {}) {
  const configured = env.DEAR_CONGRESS_URL;
  return !configured || ['https://dear-congress.fly.dev/api','https://dear-congress.fly.dev/api/'].includes(configured)
    ? 'https://civic-synthesis.fly.dev/api' : configured;
}

/** Do not silently move journal writes when updating public read routing. */
export function civicPublishUrl(env = {}) {
  return env.DEAR_CONGRESS_URL || null;
}
