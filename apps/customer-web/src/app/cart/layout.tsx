import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Your cart',
  description: 'Items you have scanned in this shop, ready for checkout.',
  path: '/cart',
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
