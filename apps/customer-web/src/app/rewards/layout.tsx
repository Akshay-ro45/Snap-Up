import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Rewards',
  description: 'How SnapCount rewards work for regular SnapUp shoppers.',
  path: '/rewards',
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
