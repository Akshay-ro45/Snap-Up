import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Offers',
  description: 'Promotions from shops on SnapUp. Discounts are applied automatically at checkout.',
  path: '/offers',
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
