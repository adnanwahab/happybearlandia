/** Exact origins only: operators explicitly approve each embedding application. */
export function policyEmbedOrigins(value = 'https://dear-congress.fly.dev') {
  return [...new Set(['https://dear-congress.fly.dev', ...value.split(',').map(part => part.trim()).filter(Boolean).map(part => {
    let url;
    try { url = new URL(part); } catch { throw new Error('Invalid HBL_POLICY_EMBED_ORIGINS'); }
    if (url.protocol !== 'https:' || url.origin !== part || url.username || url.password || part.includes('*')) {
      throw new Error('HBL_POLICY_EMBED_ORIGINS must contain exact HTTPS origins without paths or wildcards');
    }
    return url.origin;
  })])];
}

export function policyViewerHeaders(response, origins) {
  const headers = new Headers(response.headers);
  headers.set('content-security-policy', `frame-ancestors 'self' ${origins.join(' ')}; object-src 'none'; base-uri 'self'`);
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(response.body, { status: response.status, headers });
}
