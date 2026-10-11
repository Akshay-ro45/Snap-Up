import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * Crawlers may read the public pages and nothing behind a session. The disallowed paths
 * are also noindex on the pages themselves; this saves the crawl, the meta tag is what
 * actually keeps them out of results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/account',
        '/bills',
        '/cart',
        '/checkout',
        '/scan',
        '/enter',
        '/entrance/',
        '/login',
        '/p/',
        '/poster/',
        '/rewards',
        '/offers',
        '/forgot-password',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
