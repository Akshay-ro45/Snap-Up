import Link from 'next/link';
import { CookieSettingsButton } from '@/components/Analytics';

/**
 * The app has a bottom tab bar rather than a page footer, so the legal links sit at the
 * foot of the screens where people look for them — home, account and sign-in — instead of
 * in a footer that would compete with the tab bar on every screen.
 */
export default function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted ${className}`}>
      <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
        Privacy Policy
      </Link>
      <Link href="/terms" className="underline underline-offset-2 hover:text-ink">
        Terms of Use
      </Link>
      <CookieSettingsButton />
    </nav>
  );
}
