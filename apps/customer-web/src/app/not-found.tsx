import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
  // The root layout's canonical points at "/"; a missing page must not claim to be home.
  alternates: { canonical: null },
};

/**
 * Every unknown path lands here, including a mistyped store link printed on a poster —
 * so the way back is to the two places a shopper actually wants: the shop list, and the
 * scanner.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 pb-16 pt-16 text-center">
      <Image src="/logo-mark.png" alt="" width={48} height={48} className="h-12 w-auto" />
      <p className="mt-6 text-sm font-extrabold uppercase tracking-wide text-muted">404</p>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">We couldn’t find that page</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        The link may be mistyped, or the page may have moved. If you were scanning a store’s
        entrance code, try scanning it again.
      </p>

      <div className="mt-8 flex w-full flex-col gap-3">
        <Link
          href="/"
          className="rounded-2xl bg-primary py-4 text-base font-extrabold text-onPrimary transition hover:opacity-90"
        >
          Find a shop
        </Link>
        <Link
          href="/scan"
          className="rounded-2xl border border-border py-3.5 text-sm font-extrabold text-ink transition hover:bg-bg"
        >
          Open the scanner
        </Link>
      </div>
    </div>
  );
}
