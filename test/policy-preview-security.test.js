import {test, expect} from 'bun:test';
import {policyEmbedOrigins, policyViewerHeaders} from '../world/policy-preview-security.js';

test('embedding requires exact HTTPS origin allowlist', () => {
  expect(policyEmbedOrigins('https://civic.example, https://dear-congress.fly.dev,https://civic.example')).toEqual(['https://dear-congress.fly.dev', 'https://civic.example']);
  for (const origin of ['*', 'https://*.example.com', 'https://example.com/path', 'http://example.com', "https://example.com; frame-ancestors *", 'https://user:password@example.com']) {
    expect(() => policyEmbedOrigins(origin)).toThrow();
  }
});

test('viewer CSP restricts ancestors and preserves response status and headers', async () => {
  const response = policyViewerHeaders(new Response('viewer', {status: 200, headers: {'content-type':'text/html'}}), policyEmbedOrigins());
  expect(response.headers.get('content-security-policy')).toBe("frame-ancestors 'self' https://dear-congress.fly.dev; object-src 'none'; base-uri 'self'");
  expect(response.headers.get('content-type')).toBe('text/html');
  expect(await response.text()).toBe('viewer');
});
