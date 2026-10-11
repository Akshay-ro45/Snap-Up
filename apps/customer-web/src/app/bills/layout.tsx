import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'My bills',
  description: 'Bills from shops you have checked out of with SnapUp.',
  path: '/bills',
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
