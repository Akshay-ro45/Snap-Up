import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Entrance poster',
  description: 'Printable entrance poster for a SnapUp shop.',
  path: '/poster',
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
