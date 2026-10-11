import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Shop entrance',
  description: 'Scan this code with SnapUp to start shopping in this store.',
  path: '/entrance',
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
