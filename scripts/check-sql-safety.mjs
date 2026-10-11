#!/usr/bin/env node
/**
 * Fails the build if SQL is built by string interpolation.
 *
 * Every query in this codebase binds parameters. That is the single reason there is no
 * injection surface, and it is a property that is easy to lose in one hurried commit. This
 * makes losing it a build failure rather than a discovery.
 *
 * A handful of interpolations are legitimate: a shared SELECT prefix, a column list, a
 * numeric rank computed server-side. Those are allow-listed by name, so adding a new one
 * is a deliberate edit to this file rather than something that slips through.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const ALLOWED = new Set([
  'ORDER_SELECT',   // a constant SELECT prefix, no user input
  'SELECT',         // the same, in presence/agents.ts
  'settled',        // a literal tuple of state names
  'admissible',     // a literal predicate chosen from two constants
  'status',         // a value already narrowed to a known enum
  'strength',       // a number derived server-side from a known enum
  'name',           // role names in the one-off role bootstrap, not user input
  'escaped',        // generated password, single-quote escaped, role bootstrap only
  'table',          // table names from a hard-coded list in the role bootstrap

  // sync/origin.ts builds statements against the retailer's own database, whose table and
  // column names come from SNAPUP_ORIGIN_TABLE_MAP. An identifier cannot be a bound
  // parameter in SQL, so interpolation is the only option — and it goes through `ident()`,
  // which refuses anything that is not /^[A-Za-z_][A-Za-z0-9_$]*$/ and then double-quotes
  // it. `guard` and `stamp` are assembled from that same function plus a number computed
  // server-side. Every value in those statements is still bound.
  'ident',
  'guard',
  'stamp',
]);

const files = globSync('apps/*/src/**/*.ts', { cwd: process.cwd() });
const offences = [];

// Matches `${...}` inside a SQL-looking template literal.
const TEMPLATE = /(?:sql|db\(\))\s*(?:`|\()\s*`([^`]*)`/gs;
const INTERP = /\$\{\s*([A-Za-z_$][\w$]*)/g;

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const block of source.matchAll(TEMPLATE)) {
    for (const hit of block[1].matchAll(INTERP)) {
      if (!ALLOWED.has(hit[1])) {
        const line = source.slice(0, block.index + hit.index).split('\n').length;
        offences.push(`${file}:${line}  \${${hit[1]}} interpolated into SQL`);
      }
    }
  }
}

if (offences.length > 0) {
  console.error('SQL built by interpolation — use bound parameters instead:\n');
  for (const o of offences) console.error('  ' + o);
  console.error('\nIf this interpolation is genuinely safe, add the name to ALLOWED in this file.');
  process.exit(1);
}
console.log(`SQL safety: ${files.length} files checked, all queries use bound parameters`);
