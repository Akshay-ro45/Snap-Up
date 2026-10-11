'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

/**
 * Website analytics, off until the operator turns it on.
 *
 * Two supported providers, chosen by which public ID is set at build time:
 *
 *   NEXT_PUBLIC_PLAUSIBLE_DOMAIN     Plausible. Sets no cookies and stores nothing on the
 *                                    device, so it runs without a consent prompt.
 *   NEXT_PUBLIC_PLAUSIBLE_SRC        Optional; a self-hosted Plausible script URL.
 *   NEXT_PUBLIC_GA_MEASUREMENT_ID    Google Analytics 4. Uses cookies, so it is loaded only
 *                                    after the visitor accepts, and the consent banner
 *                                    exists only when this is set.
 *
 * These IDs are public by design — they appear in every page that loads the script — so
 * NEXT_PUBLIC_ is correct for them. Nothing secret belongs here.
 *
 * With neither set, this renders nothing and no third-party request is made.
 */
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const PLAUSIBLE_SRC = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.js';
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export const CONSENT_KEY = 'snapup-consent';
export const CONSENT_REOPEN_EVENT = 'snapup:consent-reopen';
type Consent = 'granted' | 'denied';

function readConsent(): Consent | null {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    // Private mode or blocked storage. Treat as undecided; the banner asks again.
    return null;
  }
}

function writeConsent(value: Consent) {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* the choice still applies for this page view */
  }
}

export default function Analytics() {
  // `undefined` until mounted: the server cannot know the stored choice, and rendering a
  // banner on the server that the client then removes would flash it at returning visitors.
  const [consent, setConsent] = useState<Consent | null | undefined>(undefined);

  useEffect(() => {
    if (!GA_ID) return;
    setConsent(readConsent());
    const reopen = () => setConsent(null);
    window.addEventListener(CONSENT_REOPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, reopen);
  }, []);

  const choose = (value: Consent) => {
    writeConsent(value);
    setConsent(value);
    // Withdrawing consent after GA has loaded: the script is already in the page, so the
    // honest thing is to reload without it rather than leave it running.
    if (value === 'denied' && (window as { gtag?: unknown }).gtag) window.location.reload();
  };

  return (
    <>
      {PLAUSIBLE_DOMAIN && (
        <Script defer data-domain={PLAUSIBLE_DOMAIN} src={PLAUSIBLE_SRC} strategy="afterInteractive" />
      )}

      {GA_ID && consent === 'granted' && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(GA_ID)},{anonymize_ip:true});`}
          </Script>
        </>
      )}

      {GA_ID && consent === null && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="consent-title"
          // Sits above the bottom tab bar on phones rather than over it; the tab bar is
          // how people leave a screen, and covering it would trap them behind the notice.
          className="fixed inset-x-0 bottom-24 z-50 mx-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-border bg-surface p-4 shadow-pop sm:bottom-6"
        >
          <p id="consent-title" className="text-sm font-extrabold text-ink">
            Analytics cookies
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            We’d like to use Google Analytics cookies to understand how SnapUp is used. Shopping
            works the same whether you accept or not.{' '}
            <a href="/privacy" className="font-bold text-primaryInk underline underline-offset-2">
              Privacy Policy
            </a>
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => choose('denied')}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-extrabold text-ink transition hover:bg-bg"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => choose('granted')}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-extrabold text-onPrimary transition hover:opacity-90"
            >
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Reopens the banner so a visitor can change their mind. Shown only when GA is configured. */
export function CookieSettingsButton() {
  if (!GA_ID) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT))}
      className="underline underline-offset-2 hover:text-ink"
    >
      Cookie settings
    </button>
  );
}
