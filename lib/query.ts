/**
 * Input that ends up inside a PostgREST filter string, such as .or(...).
 *
 * Commas, parentheses, quotes and backslashes are filter syntax there, so a
 * search for "western, blot" used to break the query outright. Row-level
 * security still applies whatever the filter says, but the filter should say
 * what the researcher typed and nothing more.
 */

/** A search term made safe for `col.ilike.%term%` inside or(): filter syntax
 *  and wildcards become spaces. */
export function likeTerm(raw: string): string {
  return String(raw ?? "").replace(/[,()"'\\%*:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

/** Row ids here are uuids (live) or short slugs like "u-bhatt" (demo). */
export const isRowId = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9-]{1,64}$/.test(s);
