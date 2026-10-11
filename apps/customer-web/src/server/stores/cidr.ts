import 'server-only';

/** `a.b.c.d/n`, with every octet in range and a prefix length of 0-32. */
const CIDR_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;

/**
 * Validates the notation only — it does not decide whether a range is *safe* to trust.
 *
 * Moved out of `memoryRepository.ts`, where it had nothing to do with the storage strategy:
 * `validation.ts` uses it to reject a malformed CIDR before a store is ever written, which
 * has to hold whichever repository is in play.
 */
export function isValidCidr(value: string): boolean {
  const match = CIDR_PATTERN.exec(value.trim());
  if (!match) return false;

  const octets = [match[1], match[2], match[3], match[4]].map(Number);
  if (octets.some((octet) => octet > 255)) return false;

  const bits = Number(match[5]);
  return bits >= 0 && bits <= 32;
}


function ipv4ToInt(ip: string): number | null {
  const octets = ip.split('.');
  if (octets.length !== 4) return null;

  let value = 0;
  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet)) return null;
    const n = Number(octet);
    if (n > 255) return null;
    value = (value << 8) | n;
  }
  // `>>> 0` because JS bitwise ops yield a signed 32-bit int and addresses above
  // 127.255.255.255 would otherwise compare as negative.
  return value >>> 0;
}

export function ipMatchesCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;

  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null) return false;

  // A /0 mask would shift by 32, which is a no-op in JS (shift counts are mod 32),
  // so it is special-cased to "match everything".
  if (bits === 0) return true;
  const mask = (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}
