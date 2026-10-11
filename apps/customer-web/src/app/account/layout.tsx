import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Your account',
  description: 'Your SnapUp account, sign-in details and preferences.',
  path: '/account',
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
