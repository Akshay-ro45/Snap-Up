import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Forgot password',
  description: 'What to do if you have forgotten your SnapUp password.',
  path: '/forgot-password',
  index: false,
});

/**
 * The sign-in screen has always linked here, and until now there was nothing here: the
 * reset flow lives in the owner console and is limited to staff accounts.
 *
 * Customers do not get a self-service reset yet, deliberately. The email on a customer
 * account is optional and was never verified, so mailing a reset link to it would hand the
 * account to whoever typed that address at registration. This page says so plainly and
 * keeps the customer moving, rather than pretending a reset exists.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-6 pb-16 pt-12 text-center">
      <h1 className="text-2xl font-extrabold text-ink">Forgot your password?</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Customer passwords cannot be reset online yet. You don’t need an account to shop —
        you can scan and pay as a guest right now.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        If you would rather keep your bills in one place, you can create a new account with a
        different username.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/scan"
          className="rounded-2xl bg-primary py-4 text-base font-extrabold text-onPrimary transition hover:opacity-90"
        >
          Shop as a guest
        </Link>
        <Link
          href="/login"
          className="rounded-2xl border border-border py-3.5 text-sm font-extrabold text-ink transition hover:bg-bg"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
