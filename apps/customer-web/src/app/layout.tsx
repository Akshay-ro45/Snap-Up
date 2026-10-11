import type { Metadata, Viewport } from 'next';
import { THEME_INIT_SCRIPT } from '@snapup/ui/theme-runtime';
import './globals.css';
import AppChrome from '@/components/AppChrome';
import Analytics from '@/components/Analytics';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, pageMetadata, SITE_NAME, SITE_URL } from '@/lib/seo';

/**
 * Site-wide defaults, and the home page's own metadata. Every other route has a
 * `layout.tsx` beside its page that overrides title, description, canonical and Open
 * Graph, so the canonical set here applies to `/` and nowhere else.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  ...pageMetadata({ description: DEFAULT_DESCRIPTION, path: '/' }),
  title: { default: DEFAULT_TITLE, template: `%s · ${SITE_NAME}` },
  icons: {
    icon: '/icon-512.png',
    apple: '/apple-touch-icon.png',
  },
};

// Colours the browser chrome to match the theme the phone is actually showing.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#00C4A7' },
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
        <div className="flex min-h-screen flex-col bg-bg">
          <AppChrome>{children}</AppChrome>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
