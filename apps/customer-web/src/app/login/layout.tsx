import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Sign in',
  description: 'Sign in to SnapUp to keep your bills and member pricing across shops.',
  path: '/login',
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
