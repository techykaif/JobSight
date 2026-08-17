/**
 * Centralized URL safety validation for discovery sources.
 *
 * Single trust boundary for user-supplied URLs before they reach any
 * server-side operation. Rejects obviously unsafe destinations without
 * requiring DNS resolution.
 *
 * Scope: local-first hardening. Not a full enterprise SSRF proxy.
 */

export interface UrlSafetyResult {
  safe: boolean;
  reason?: string;
}

/**
 * Validates a URL for use as a discovery source.
 * Returns { safe: true } for acceptable URLs.
 * Returns { safe: false, reason } for rejected URLs.
 */
export function checkDiscoveryUrlSafety(url: unknown): UrlSafetyResult {
  if (typeof url !== 'string' || url.trim().length === 0) {
    return { safe: false, reason: 'URL must be a non-empty string' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { safe: false, reason: 'Malformed URL (failed WHATWG URL parsing)' };
  }

  const scheme = parsed.protocol.toLowerCase();

  // 1. Scheme allowlist — only http/https are permitted
  if (scheme !== 'https:' && scheme !== 'http:') {
    return { safe: false, reason: `Unsupported scheme: ${scheme}` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Loopback / localhost
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^127\./.test(hostname) ||
    hostname === '0.0.0.0'
  ) {
    return { safe: false, reason: 'Loopback/localhost address rejected' };
  }

  // 3. IPv6 loopback / any-address
  if (hostname === '::1' || hostname === '[::1]' || hostname === '[::]' || hostname === '::') {
    return { safe: false, reason: 'IPv6 loopback address rejected' };
  }

  // 4. Private IPv4 ranges (RFC 1918)
  if (
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)
  ) {
    return { safe: false, reason: 'Private IPv4 address rejected' };
  }

  // 5. Link-local (169.254.x.x) — covers AWS/GCP/Azure IMDS endpoints
  if (/^169\.254\./.test(hostname)) {
    return { safe: false, reason: 'Link-local address rejected (includes cloud metadata endpoints)' };
  }

  // 6. IPv6 private/local ranges (ULA, link-local, IPv4-mapped loopback)
  if (
    /^fc00:/i.test(hostname) ||
    /^fd[0-9a-f]{2}:/i.test(hostname) ||
    /^fe80:/i.test(hostname) ||
    /^::ffff:127\./i.test(hostname) ||
    /^::ffff:10\./i.test(hostname) ||
    /^::ffff:192\.168\./i.test(hostname)
  ) {
    return { safe: false, reason: 'Private/local IPv6 address rejected' };
  }

  // 7. Known cloud metadata endpoints by hostname
  if (
    hostname === 'metadata.google.internal' ||
    hostname === '169.254.170.2' ||
    hostname === 'metadata.azure.com'
  ) {
    return { safe: false, reason: 'Cloud metadata endpoint rejected' };
  }

  return { safe: true };
}

/**
 * Returns true if the URL is safe to use as a discovery source.
 * Convenience wrapper around checkDiscoveryUrlSafety.
 */
export function isDiscoveryUrlSafe(url: unknown): boolean {
  return checkDiscoveryUrlSafety(url).safe;
}
