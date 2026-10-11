import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ContactBlock,
  isComplete,
  LegalDocument,
  operatorDetails,
  Section,
  Value,
} from '@/components/legal/LegalDocument';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy',
  description: 'What information SnapUp collects when you shop, why, who it is shared with, and how long it is kept.',
  path: '/privacy',
});

// Operator details are read from the environment on each request; see LegalDocument.
export const dynamic = 'force-dynamic';

/**
 * Written from what the code does, not from a template. Each statement below corresponds to
 * something in this repository; where the answer is a business decision the code cannot
 * make — retention of orders, who the operator is — it is marked for the operator instead
 * of guessed.
 */
export default function PrivacyPage() {
  const operator = operatorDetails();
  const complete = isComplete(operator, ['entity', 'email', 'address', 'effectiveDate']);

  return (
    <LegalDocument title="Privacy Policy" operator={operator} complete={complete}>
      <Section heading="Who we are">
        <p>
          SnapUp lets you scan products with your phone while you shop in a participating store,
          pay, and leave without queueing at a till. It is operated by{' '}
          <Value value={operator.entity} what="legal name of the business running SnapUp" envVar="SNAPUP_LEGAL_ENTITY_NAME" />.
          Each store you shop in is a separate business that sells you the goods.
        </p>
      </Section>

      <Section heading="What we collect, and why">
        <p className="font-bold">When you shop, with or without an account</p>
        <ul>
          <li>
            <b>Your network address (IP).</b> Used to confirm you are connected to the store’s own
            network before shopping starts, and checked again while you shop. It is written into
            your signed, short-lived session token; it is not stored in our database for
            shopping. We also use it to limit repeated sign-in attempts.
          </li>
          <li>
            <b>A random shopping-session identifier</b> and which store you are in.
          </li>
          <li>
            <b>What you scan and buy:</b> products, quantities, prices, totals, how you chose to
            pay, a payment reference, and the short code shown to staff at the exit. If the store
            weighs baskets at the exit, the reading is recorded with the order.
          </li>
          <li>
            <b>Store activity:</b> for each shopping session we record when it started and ended,
            which products were scanned and in which aisle, barcodes the store does not stock,
            and completed orders. Store owners see this as totals and trends for their store.
          </li>
        </ul>

        <p className="font-bold">Only if you allow it</p>
        <ul>
          <li>
            <b>Location.</b> If you let your browser share your location, it is sent with the
            request that lists nearby stores so they can be sorted by distance. SnapUp does not
            save it.
          </li>
          <li>
            <b>Camera.</b> Barcodes are read on your phone. Camera images are not sent to us.
          </li>
        </ul>

        <p className="font-bold">If you create an account</p>
        <ul>
          <li>Your username and password. Passwords are stored only as a one-way hash.</li>
          <li>Optionally, your name and email address.</li>
          <li>If you sign in with Google: the email address and name Google shares with us.</li>
          <li>If you sign in with a one-time code: your mobile number.</li>
          <li>Your bills, so you can see them again from another phone.</li>
        </ul>

        <p className="font-bold">Store owners and staff</p>
        <ul>
          <li>
            Name, work email, optional phone number, password hash, role, and the store you work
            at. When a password reset is requested we record the requesting IP address.
          </li>
        </ul>
      </Section>

      <Section heading="Payments">
        <p>
          When you pay by UPI from SnapUp, the payment goes directly from your UPI app to the
          store’s own UPI account. SnapUp never receives or holds the money, and never sees your
          bank or card details.
        </p>
        <p>
          A store may instead use an online payment provider. That provider processes your
          payment under its own terms and privacy policy, and sends us only whether the payment
          succeeded, the amount, and its reference. The payment window is the provider’s, and
          it may use its own cookies.
        </p>
      </Section>

      <Section heading="On your device">
        <p>SnapUp uses only what it needs to work. There are no advertising or cross-site tracking cookies.</p>
        <ul>
          <li>
            <code>snapup_account</code> — a secure cookie that keeps you signed in. Not readable
            by page scripts.
          </li>
          <li>
            <code>snapup-cart-storage</code> — your cart, kept in your browser so it survives a
            refresh.
          </li>
          <li>
            <code>snapup-auth-storage</code> — whether you are signed in, for display.
          </li>
          <li>
            <code>snapup-session</code> — your current shopping session. Cleared when you close
            the tab.
          </li>
          <li>Your light or dark theme choice.</li>
        </ul>
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <p>
            <b>Plausible Analytics</b> counts page visits to show us how SnapUp is used. It sets
            no cookies, stores nothing on your device, and does not identify you.
          </p>
        )}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? (
          <p>
            <b>Google Analytics</b> cookies (<code>_ga</code>, <code>_ga_*</code>) are set only if
            you accept them in the cookie notice, and help us understand how SnapUp is used.
            Shopping works the same if you decline. You can change your choice with “Cookie
            settings” at the foot of the home and account screens.
          </p>
        ) : (
          !process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && <p>SnapUp does not currently use website analytics.</p>
        )}
      </Section>

      <Section heading="Who we share it with">
        <ul>
          <li>
            <b>The store you shop in</b> — your order, its payment status and your exit code, so
            staff can check your basket and give you your bill; and the store activity described
            above.
          </li>
          <li>
            <b>Service providers that run SnapUp for us</b>, each only for its own part: our
            hosting provider and database provider; a payment provider, if the store uses one;
            an SMS provider, to send one-time codes; an email provider, to send staff password
            resets; Google, if you choose Google sign-in; and a rate-limiting service that sees
            network addresses, if enabled.
          </li>
          <li>Anyone we are legally required to share it with.</li>
        </ul>
        <p>We do not sell your information.</p>
      </Section>

      <Section heading="How long we keep it">
        <ul>
          <li>One-time sign-in codes: deleted about an hour after they expire.</li>
          <li>Password-reset links: deleted seven days after they expire.</li>
          <li>
            Orders, bills, store activity and accounts:{' '}
            <Value value={null} what="how long these are kept, and when they are deleted" envVar="(policy decision — edit this page)" />
          </li>
        </ul>
      </Section>

      <Section heading="Your choices">
        <p>
          You can shop as a guest without an account. You can ask us for a copy of the
          information we hold about you, to correct it, or to delete your account, by contacting
          us below. Depending on where you live, the law may give you further rights.
        </p>
      </Section>

      <Section heading="Contact">
        <ContactBlock operator={operator} />
      </Section>

      <Section heading="Changes">
        <p>
          If this policy changes, the new version will be posted here with a new effective date.
          See also our <Link href="/terms" className="font-bold text-primaryInk underline underline-offset-2">Terms of Use</Link>.
        </p>
      </Section>
    </LegalDocument>
  );
}
