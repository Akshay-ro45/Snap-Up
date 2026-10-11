import type { MetadataRoute } from 'next';

/** A private console. Nothing here is for search engines; every page is also noindex. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
