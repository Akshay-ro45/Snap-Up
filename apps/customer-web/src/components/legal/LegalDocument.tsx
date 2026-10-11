import Link from 'next/link';

/**
 * Operator details the legal pages need and the code cannot know.
 *
 * Read on the server at request time, so filling them in on the deployment is a config
 * change, not a code change. Anything unset renders as a visible "to be provided" marker
 * and puts a draft notice at the top of the page — a policy that silently printed an
 * empty company name would look finished when it is not.
 */
export function operatorDetails() {
  const read = (name: string) => {
    const value = process.env[name]?.trim();
    return value ? value : null;
  };
  return {
    entity: read('SNAPUP_LEGAL_ENTITY_NAME'),
    email: read('SNAPUP_LEGAL_CONTACT_EMAIL'),
    address: read('SNAPUP_LEGAL_POSTAL_ADDRESS'),
    jurisdiction: read('SNAPUP_LEGAL_JURISDICTION'),
    effectiveDate: read('SNAPUP_LEGAL_EFFECTIVE_DATE'),
  };
}

export type Operator = ReturnType<typeof operatorDetails>;

export function isComplete(operator: Operator, required: (keyof Operator)[]): boolean {
  return required.every((key) => operator[key] !== null);
}

/** A value the operator still has to supply. Deliberately loud. */
export function Missing({ what, envVar }: { what: string; envVar: string }) {
  return (
    <mark className="rounded bg-warning/20 px-1 font-bold text-ink">
      [To be provided by the operator: {what} — <code>{envVar}</code>]
    </mark>
  );
}

export function Value({
  value,
  what,
  envVar,
}: {
  value: string | null;
  what: string;
  envVar: string;
}) {
  return value ? <>{value}</> : <Missing what={what} envVar={envVar} />;
}

export function LegalDocument({
  title,
  operator,
  complete,
  children,
}: {
  title: string;
  operator: Operator;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-2xl px-4 pb-16 pt-6 text-ink sm:px-6">
      <Link href="/" className="text-sm font-bold text-primaryInk underline underline-offset-2">
        ← Back to SnapUp
      </Link>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        Effective:{' '}
        <Value
          value={operator.effectiveDate}
          what="the date this version takes effect"
          envVar="SNAPUP_LEGAL_EFFECTIVE_DATE"
        />
      </p>

      {!complete && (
        <div
          role="note"
          className="mt-6 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm leading-relaxed"
        >
          <p className="font-extrabold">Draft — not yet complete</p>
          <p className="mt-1">
            This page describes how SnapUp actually handles information today, but details only
            the operator can supply are still marked below. It has not been reviewed by a lawyer
            and should be before the service is offered to the public.
          </p>
        </div>
      )}

      <div className="legal-prose mt-8 space-y-8 text-[15px] leading-relaxed">{children}</div>
    </article>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-extrabold">{heading}</h2>
      <div className="mt-3 space-y-3 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>
    </section>
  );
}

export function ContactBlock({ operator }: { operator: Operator }) {
  return (
    <ul>
      <li>
        Operator: <Value value={operator.entity} what="legal name of the business running SnapUp" envVar="SNAPUP_LEGAL_ENTITY_NAME" />
      </li>
      <li>
        Email:{' '}
        {operator.email ? (
          <a className="font-bold text-primaryInk underline underline-offset-2" href={`mailto:${operator.email}`}>
            {operator.email}
          </a>
        ) : (
          <Missing what="a monitored contact email for privacy questions" envVar="SNAPUP_LEGAL_CONTACT_EMAIL" />
        )}
      </li>
      <li>
        Post: <Value value={operator.address} what="postal address" envVar="SNAPUP_LEGAL_POSTAL_ADDRESS" />
      </li>
    </ul>
  );
}
