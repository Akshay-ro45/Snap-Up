import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ContactBlock,
  isComplete,
  LegalDocument,
  Missing,
  operatorDetails,
  Section,
  Value,
} from '@/components/legal/LegalDocument';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Terms of Use',
  description: 'The terms for using SnapUp to scan, pay and leave participating stores.',
  path: '/terms',
});

export const dynamic = 'force-dynamic';

/**
 * Describes the rules the product already enforces — presence, exit verification, who the
 * money goes to — in plain words. Liability and governing law are the operator's to set,
 * and are marked rather than written.
 */
export default function TermsPage() {
  const operator = operatorDetails();
  const complete = isComplete(operator, ['entity', 'email', 'address', 'jurisdiction', 'effectiveDate']);

  return (
    <LegalDocument title="Terms of Use" operator={operator} complete={complete}>
      <Section heading="About these terms">
        <p>
          These terms apply when you use SnapUp, which is operated by{' '}
          <Value value={operator.entity} what="legal name of the business running SnapUp" envVar="SNAPUP_LEGAL_ENTITY_NAME" />.
          By using SnapUp you agree to them. The goods you buy are sold to you by the store you
          shop in, not by SnapUp, and the store’s own terms and returns policy also apply.
        </p>
      </Section>

      <Section heading="How SnapUp works">
        <ul>
          <li>
            You can only start shopping while connected to the store’s own network, after
            scanning the code at the entrance. A session lasts 30 minutes and renews
            automatically while you are still in the store.
          </li>
          <li>
            Prices come from the store. The price you pay is the one the store confirms when you
            check out, which may differ from an estimate shown earlier.
          </li>
          <li>
            Your bill is issued when a member of staff has checked your basket and approved your
            exit.
          </li>
        </ul>
      </Section>

      <Section heading="Your responsibilities">
        <ul>
          <li>Scan every item you take, and pay for your basket before you leave.</li>
          <li>Show your exit code to staff, and let them check your basket if they ask.</li>
          <li>
            Only confirm that you have paid when the payment has actually gone through. A store
            may refuse to let a basket leave until payment is verified.
          </li>
          <li>Keep your password private, and do not use someone else’s account.</li>
          <li>Do not interfere with SnapUp, or try to get around its checks.</li>
        </ul>
      </Section>

      <Section heading="Payments and refunds">
        <p>
          Money you pay goes to the store, either directly to its UPI account or through a payment
          provider it uses. Refunds, returns and disputes about goods are handled by the store
          under its own policy.
        </p>
      </Section>

      <Section heading="Accounts">
        <p>
          You can shop as a guest. If you create an account, we may suspend it if it is used to
          break these terms or to abuse the service.
        </p>
      </Section>

      <Section heading="Availability and liability">
        <p>
          We work to keep SnapUp running, but it may sometimes be unavailable, for example during
          maintenance or if the store’s network is down. When it is, you can pay at the store’s counter instead.
        </p>
        <p>
          <Missing what="warranty and limitation-of-liability wording, reviewed by a lawyer" envVar="(edit this page)" />
        </p>
      </Section>

      <Section heading="Governing law">
        <p>
          These terms are governed by{' '}
          <Value value={operator.jurisdiction} what="governing law and courts" envVar="SNAPUP_LEGAL_JURISDICTION" />.
        </p>
      </Section>

      <Section heading="Contact">
        <ContactBlock operator={operator} />
        <p>
          See also our <Link href="/privacy" className="font-bold text-primaryInk underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </Section>
    </LegalDocument>
  );
}
