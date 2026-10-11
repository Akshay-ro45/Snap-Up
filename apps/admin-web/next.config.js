const { securityHeaders, STATIC_ASSET_CACHE } = require('@snapup/ui/securityHeaders');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Announcing the framework and version to every response helps nobody but a scanner.
  poweredByHeader: false,
  images: { formats: ['image/avif', 'image/webp'] },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders({ camera: true }) },
      { source: '/:file(logo|logo-mark|icon-512|apple-touch-icon).png', headers: STATIC_ASSET_CACHE },
    ];
  },
  // `@snapup/ui` ships TypeScript/JSX source rather than a built bundle, so Next has to
  // compile it the same way it compiles this app's own `src`.
  transpilePackages: ['@snapup/ui'],
};

module.exports = nextConfig;
