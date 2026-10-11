import 'server-only';

/**
 * The hidden field on the open signup forms.
 *
 * A person never sees it: it is off-screen, out of the tab order, and marked
 * `autocomplete="off"`. Scripts that fill in every field they find fill this one too. It is
 * a cheap first filter in front of the per-address rate limits, not a replacement for
 * them, and it needs no third-party service or credentials.
 *
 * Named like an ordinary field on purpose; a field called "honeypot" is one a bot skips.
 */
export const HONEYPOT_FIELD = 'website';

export function trippedHoneypot(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const value = (body as Record<string, unknown>)[HONEYPOT_FIELD];
  return typeof value === 'string' && value.trim().length > 0;
}
