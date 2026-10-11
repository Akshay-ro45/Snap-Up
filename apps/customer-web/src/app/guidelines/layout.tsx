import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'How to scan',
  description: 'How to scan barcodes quickly and reliably with SnapUp, and what to do at the exit.',
  path: '/guidelines',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
