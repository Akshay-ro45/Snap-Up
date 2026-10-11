/**
 * Response headers both apps send on every route.
 *
 * TLS is terminated at Railway's edge, which already answers plain HTTP with a 301 to
 * HTTPS. HSTS is what stops the browser making that first plain request at all on later
 * visits. Browsers ignore HSTS on http://localhost, so local development is unaffected.
 * `preload` is deliberately absent: it is a commitment about a whole registrable domain,
 * and belongs to whoever owns the custom domain, not to this repository.
 *
 * There is no script-restricting Content-Security-Policy yet. Next.js injects inline
 * scripts, and the payment widgets load from their providers' CDNs; a policy strict
 * enough to matter needs per-request nonces, which is its own piece of work. The one
 * directive here, `frame-ancestors`, restricts nothing the app does — it only stops other
 * sites framing these pages for clickjacking.
 *
 * @param {{ camera?: boolean, geolocation?: boolean }} allow  browser features the app uses
 */
function securityHeaders(allow = {}) {
  const permissions = [
    `camera=${allow.camera ? '(self)' : '()'}`,
    `geolocation=${allow.geolocation ? '(self)' : '()'}`,
    'microphone=()',
    'usb=()',
    'interest-cohort=()',
  ].join(', ');

  return [
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: permissions },
  ];
}

/** Brand images in /public change rarely; a day's cache, revalidated after. */
const STATIC_ASSET_CACHE = [
  { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
];

module.exports = { securityHeaders, STATIC_ASSET_CACHE };
