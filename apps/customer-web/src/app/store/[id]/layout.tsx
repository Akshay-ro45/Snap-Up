import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { getStore } from '@/server/stores';

/**
 * A shop's own page, named after the shop. These are the pages someone searching for the
 * shop could reasonably land on, so they are indexed — an inactive or unknown shop is not.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const store = await getStore(id).catch(() => null);

  if (!store || !store.isActive) {
    return pageMetadata({
      title: 'Shop not found',
      description: 'This shop is not on SnapUp.',
      path: `/store/${encodeURIComponent(id)}`,
      index: false,
    });
  }

  return pageMetadata({
    title: store.name,
    description: `Shop at ${store.name} with SnapUp: scan items as you go and check out without the queue.${
      store.address ? ` ${store.address}.` : ''
    }`,
    path: `/store/${encodeURIComponent(store.id)}`,
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
