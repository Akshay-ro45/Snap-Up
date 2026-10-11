import type { Metadata, Viewport } from 'next';
import { THEME_INIT_SCRIPT } from '@snapup/ui/theme-runtime';
import './globals.css';
import AppShell from '@/components/AppShell';

/**
 * The console is a private back office: every screen is behind a sign-in, and none of it
 * should appear in search results. `noindex` is set here once and inherited by every
 * route; robots.ts asks crawlers not to fetch it at all.
 */
export const metadata: Metadata = {
  title: { default: 'SnapUp Business — Owner Dashboard', template: '%s · SnapUp Business' },
  description: 'Manage products, staff, and store analytics for your SnapUp locations.',
  applicationName: 'SnapUp Business',
  robots: { index: false, follow: false, nocache: true },
  icons: {
    icon: '/icon-512.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#00C896' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1210' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script below sets data-theme before React runs, so
    // the server's markup and the client's first read of <html> legitimately differ.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
