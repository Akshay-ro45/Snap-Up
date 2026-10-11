import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Page not found' };

/** Unknown console paths: back to the dashboard, which signs the user in if needed. */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <p className="text-sm font-extrabold uppercase tracking-wide text-muted">404</p>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">That page doesn’t exist</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        The link may be mistyped, or the page may have moved.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-accent px-8 py-3.5 text-sm font-extrabold text-onAccent transition hover:opacity-90"
      >
        Go to the dashboard
      </Link>
    </div>
  );
}
