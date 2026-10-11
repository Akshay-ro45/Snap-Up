import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Start shopping',
  description: 'Opening this shop in SnapUp so you can scan and pay without queueing.',
  path: '/p',
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
