import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Entering the shop',
  description: 'Confirming you are in the shop before you start scanning.',
  path: '/enter',
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
