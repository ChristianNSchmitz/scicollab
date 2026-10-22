/**
 * ORCID iD handling, shared by the browser and the server.
 *
 * An ORCID iD is 16 characters in four groups; the last one is a checksum
 * (ISO 7064 MOD 11-2, where 10 is written X). Checking it catches most typos
 * before anything is linked or sent to OpenAlex.
 */

const SHAPE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

/** Accepts "0000-0002-1825-0097", "https://orcid.org/0000-…", "orcid.org/…",
 *  or the 16 characters without dashes. Returns the canonical form or null. */
export function normaliseOrcid(raw: string | null | undefined): string | null {
  let v = String(raw ?? "").trim().toUpperCase();
  v = v.replace(/^HTTPS?:\/\//, "").replace(/^(WWW\.)?ORCID\.ORG\//, "").replace(/\/$/, "");
  if (/^[\dX]{16}$/.test(v.replace(/[\s-]/g, "")) && !SHAPE.test(v)) {
    const d = v.replace(/[\s-]/g, "");
    v = `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return SHAPE.test(v) && checksumOk(v) ? v : null;
}

export function checksumOk(orcid: string): boolean {
  const digits = orcid.replace(/-/g, "");
  let total = 0;
  for (const ch of digits.slice(0, 15)) total = (total + Number(ch)) * 2;
  const result = (12 - (total % 11)) % 11;
  return digits[15] === (result === 10 ? "X" : String(result));
}

/** Why an entry is not an ORCID iD, in words a researcher can act on. */
export function orcidProblem(raw: string): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  if (normaliseOrcid(v)) return null;
  const bare = v.toUpperCase().replace(/^HTTPS?:\/\//, "").replace(/^(WWW\.)?ORCID\.ORG\//, "").replace(/[\s-]/g, "");
  if (!/^[\dX]{16}$/.test(bare)) return "An ORCID iD has 16 characters in four groups, like 0000-0002-1825-0097.";
  return "The last character does not match the rest. Check the iD for a typo.";
}

export const orcidUrl = (orcid: string) => `https://orcid.org/${orcid}`;
