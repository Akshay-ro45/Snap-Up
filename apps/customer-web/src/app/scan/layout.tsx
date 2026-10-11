import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Scan',
  description: 'Scan product barcodes to add them to your cart.',
  path: '/scan',
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
