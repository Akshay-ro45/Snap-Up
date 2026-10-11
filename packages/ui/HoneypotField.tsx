/**
 * The decoy input for the open signup forms; see `server/honeypot.ts` in customer-web.
 *
 * Hidden with off-screen positioning rather than `display: none` or `type="hidden"`, both
 * of which many form-filling scripts know to skip. `aria-hidden` and `tabIndex={-1}` keep
 * it away from screen readers and keyboard users, who must never be able to trip it.
 */
export default function HoneypotField() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

/** Reads the decoy's value off a submitted form. Empty for every real person. */
export function honeypotValue(form: HTMLFormElement): string {
  const value = new FormData(form).get('website');
  return typeof value === 'string' ? value : '';
}
