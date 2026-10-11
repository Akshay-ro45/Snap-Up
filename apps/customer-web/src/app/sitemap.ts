import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { listStoresForPosterLookup } from '@/server/stores';

/** Rebuilt hourly, so a newly registered shop appears without a redeploy. */
export const revalidate = 3600;

/**
 * Only pages that mean something to someone arriving from a search: the home page, the
 * scanning guide, each active shop, and the legal pages. Everything tied to a session or
 * an account is excluded here and marked noindex on the page itself.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/guidelines`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  // A database that cannot be reached must not take the sitemap down with it: the fixed
  // pages are still worth serving, and the shops return on the next revalidation.
  const stores = await listStoresForPosterLookup().catch(() => []);

  return [
    ...fixed,
    ...stores.map((store) => ({
      url: `${SITE_URL}/store/${encodeURIComponent(store.id)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
