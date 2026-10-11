#!/usr/bin/env node
/**
 * Refuses a migration that cannot finish.
 *
 * `db-migrate.mjs` applies statements one at a time. If the credential can create tables
 * but not alter existing ones, the run gets part-way through and stops, leaving the
 * client's schema in a state that matches neither the old version nor the new one. That is
 * the worst outcome available, and it is entirely avoidable: the privileges needed are
 * knowable before the first statement runs.
 *
 * This checks them and exits non-zero with a specific instruction if anything is missing.
 */
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url || url.startsWith('file:')) {
  console.log('No hosted DATABASE_URL — nothing to check.');
  process.exit(0);
}

const sql = neon(url);
const schema = readFileSync('apps/customer-web/src/server/db/schema.sql', 'utf8');

// Tables the schema expects to ALTER. Creating a table needs CREATE on the schema;
// altering one needs ownership, which is a different and stricter thing.
const altered = [...new Set(
  [...schema.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-z_]+)/gi)].map((m) => m[1].toLowerCase())
)];

const problems = [];

const [me] = await sql(`SELECT current_user AS u`);
console.log(`migrating as: ${me.u}`);

const [schemaPriv] = await sql(
  `SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS can_create`
);
if (!schemaPriv.can_create) {
  problems.push('cannot CREATE in schema public — new tables and indexes would fail');
}

// Ownership, directly or through role membership. pg_has_role covers the membership case
// even when the role is NOINHERIT, because an explicit SET ROLE would still be available.
const owners = await sql(
  `SELECT c.relname,
          r.rolname AS owner,
          pg_has_role(current_user, c.relowner, 'USAGE') AS can_assume
     FROM pg_class c
     JOIN pg_roles r ON r.oid = c.relowner
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1)`,
  [altered]
);

const blocked = owners.filter((row) => !row.can_assume);
if (blocked.length > 0) {
  problems.push(
    `cannot ALTER ${blocked.length} existing table(s) owned by ${blocked[0].owner}: ` +
      blocked.map((r) => r.relname).slice(0, 6).join(', ') +
      (blocked.length > 6 ? ', …' : '')
  );
}

if (problems.length > 0) {
  console.error('\nThis credential cannot complete the migration. Nothing has been applied.\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`
Postgres requires ownership of a table to ALTER it; there is no narrower grant. Pick one:

  A. Let the migrator assume ownership only when it needs to. Run once, as the owner:
         GRANT neondb_owner TO snapup_migrator;
     The role is NOINHERIT, so a migration must say SET ROLE neondb_owner explicitly —
     the escalation is visible in the script rather than ambient.

  B. Put the owner connection string in this job's environment instead, and nowhere else.
     Same power, no extra grant, but the owner credential then lives in CI as well as
     with the client.

A is the better separation. B is the smaller change. Either is a decision for whoever
owns the database, which is why this script stops rather than choosing.
`);
  process.exit(1);
}

console.log(`privileges ok: CREATE on public, ownership of ${owners.length} table(s) to alter`);
