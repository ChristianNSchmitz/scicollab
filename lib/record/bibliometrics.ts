import { isConfigured } from "@/lib/mode";

/**
 * Citations and h-index, from OpenAlex by the researcher's ORCID.
 *
 * Nothing is computed here: both numbers are OpenAlex's own, cached for a
 * day, and shown with their source and date so they can be checked. If there
 * is no ORCID, or OpenAlex cannot be reached, the page says so instead of
 * showing a zero that would look like a fact.
 */

export type Bibliometrics =
  | { state: "ok"; citations: number; hIndex: number; works: number; citationsThisYear: number; year: number; updated: string; url: string; example?: boolean }
  | { state: "no-orcid" }
  | { state: "invalid-orcid"; orcid: string }
  | { state: "not-found"; orcid: string }
  | { state: "unreachable"; orcid: string };

const ORCID = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

/** The demo persona's ORCID is ORCID's own public test record, not a person. */
const DEMO_ORCID = "0000-0002-1825-0097";

export async function bibliometricsFor(orcidRaw: string | null | undefined): Promise<Bibliometrics> {
  const orcid = (orcidRaw ?? "").trim().replace(/^https?:\/\/orcid\.org\//, "");
  if (!orcid) return { state: "no-orcid" };
  if (!ORCID.test(orcid)) return { state: "invalid-orcid", orcid };

  const year = new Date().getFullYear();
  if (!isConfigured() && orcid === DEMO_ORCID) {
    return { state: "ok", citations: 412, hIndex: 11, works: 34, citationsThisYear: 57, year, updated: new Date().toISOString(), url: `https://orcid.org/${orcid}`, example: true };
  }

  const key = process.env.OPENALEX_API_KEY;
  const url = `https://api.openalex.org/authors/orcid:${orcid}${key ? `?api_key=${encodeURIComponent(key)}` : ""}`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(5000) });
    if (res.status === 404) return { state: "not-found", orcid };
    if (!res.ok) return { state: "unreachable", orcid };
    const a = await res.json();
    const thisYear = (a.counts_by_year ?? []).find((c: any) => c.year === year)?.cited_by_count ?? 0;
    return {
      state: "ok",
      citations: a.cited_by_count ?? 0,
      hIndex: a.summary_stats?.h_index ?? 0,
      works: a.works_count ?? 0,
      citationsThisYear: thisYear,
      year,
      updated: a.updated_date ?? "",
      url: `https://openalex.org/${String(a.id ?? "").split("/").pop()}`,
    };
  } catch {
    return { state: "unreachable", orcid };
  }
}
