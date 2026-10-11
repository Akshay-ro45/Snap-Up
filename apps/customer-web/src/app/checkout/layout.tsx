import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Checkout',
  description: 'Pay for your basket and get the code to show at the exit.',
  path: '/checkout',
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
