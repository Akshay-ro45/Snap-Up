const { securityHeaders, STATIC_ASSET_CACHE } = require('@snapup/ui/securityHeaders');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Announcing the framework and version to every response helps nobody but a scanner.
  poweredByHeader: false,
  images: { formats: ['image/avif', 'image/webp'] },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders({ camera: true, geolocation: true }) },
      { source: '/banners/:path*', headers: STATIC_ASSET_CACHE },
      { source: '/:file(logo|logo-mark|icon-512|apple-touch-icon).png', headers: STATIC_ASSET_CACHE },
    ];
  },
  // `@snapup/ui` ships TypeScript/JSX source rather than a built bundle, so Next has to
  // compile it the same way it compiles this app's own `src`.
  transpilePackages: ['@snapup/ui'],

  // PGlite ships a WASM build of Postgres plus its own filesystem shim. Bundling that
  // through webpack rewrites the asset paths it resolves at runtime, so it is loaded as a
  // real Node dependency instead. Harmless when the app is pointed at hosted Postgres —
  // the package is then never imported at all.
  serverExternalPackages: ['@electric-sql/pglite'],
};

module.exports = nextConfig;
