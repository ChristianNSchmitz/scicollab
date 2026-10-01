/**
 * OpenAlex API client — only what the sync needs.
 *
 * OpenAlex meters usage: without a key there is a small free daily allowance
 * (1,000 requests at the time of writing), so a sync costs one request for the
 * author and one per 200 works. Set OPENALEX_API_KEY for a larger allowance.
 * Every call has a timeout; a 429 is reported as rate limiting, not an error.
 */

/**
 * Careful with counts_by_year. On a WORK it is the citations that work
 * received in each year. On an AUTHOR, OpenAlex currently groups citations by
 * the publication year of the cited works (its entries sum to the author's
 * total), which is not a history of citations over time. The sync therefore
 * builds the per-year history by adding up the works' own counts_by_year.
 */
export type OAAuthor = {
  id: string;                 // short form, e.g. A5023888391
  display_name: string;
  works_count: number;
  cited_by_count: number;
  h_index: number;
  i10_index: number;
  counts_by_year: { year: number; cited_by_count: number; works_count: number }[];
  updated_date: string | null;
};

export type OAWork = {
  id: string;                 // short form, e.g. W2741809807
  doi: string | null;
  title: string;
  year: number | null;
  pub_date: string | null;
  venue: string;
  type: string;
  cited_by_count: number;
  /** Citations this work received in each year (OpenAlex covers roughly the last 14 years). */
  received: { year: number; cited_by_count: number }[];
};

export class OpenAlexError extends Error {
  constructor(public kind: "not-found" | "rate-limited" | "unreachable", message: string, public retryAfter?: number) {
    super(message);
  }
}

// Overridable only so the sync can be tested against a stand-in server.
const BASE = process.env.OPENALEX_BASE_URL || "https://api.openalex.org";
const short = (id: string) => String(id ?? "").split("/").pop() ?? "";
const MAX_WORKS = 2000;   // a guard against runaway paging on mis-merged profiles

async function get(path: string, params: Record<string, string>) {
  const q = new URLSearchParams(params);
  if (process.env.OPENALEX_API_KEY) q.set("api_key", process.env.OPENALEX_API_KEY);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}?${q}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  } catch (e) {
    throw new OpenAlexError("unreachable", `OpenAlex could not be reached (${(e as Error).name}).`);
  }
  if (res.status === 404) throw new OpenAlexError("not-found", "OpenAlex has no record for this ORCID.");
  if (res.status === 429) {
    const after = Number(res.headers.get("retry-after") ?? "") || undefined;
    throw new OpenAlexError("rate-limited", "OpenAlex's daily allowance is used up; the sync will retry later.", after);
  }
  if (!res.ok) throw new OpenAlexError("unreachable", `OpenAlex answered ${res.status}.`);
  return res.json();
}

export async function fetchAuthor(orcid: string): Promise<OAAuthor> {
  const a = await get(`/authors/orcid:${orcid}`, {
    select: "id,display_name,works_count,cited_by_count,summary_stats,counts_by_year,updated_date",
  });
  return {
    id: short(a.id),
    display_name: a.display_name ?? "",
    works_count: a.works_count ?? 0,
    cited_by_count: a.cited_by_count ?? 0,
    h_index: a.summary_stats?.h_index ?? 0,
    i10_index: a.summary_stats?.i10_index ?? 0,
    counts_by_year: (a.counts_by_year ?? []).map((c: any) => ({
      year: c.year, cited_by_count: c.cited_by_count ?? 0, works_count: c.works_count ?? 0,
    })),
    updated_date: a.updated_date ?? null,
  };
}

/** All works of an author, newest first, following OpenAlex's cursor. */
export async function fetchWorks(authorId: string): Promise<OAWork[]> {
  const out: OAWork[] = [];
  let cursor: string | null = "*";
  while (cursor && out.length < MAX_WORKS) {
    const page: any = await get("/works", {
      filter: `author.id:${authorId}`,
      select: "id,doi,display_name,publication_year,publication_date,cited_by_count,type,primary_location,counts_by_year",
      sort: "publication_date:desc",
      per_page: "200",
      cursor,
    });
    for (const w of page.results ?? []) {
      out.push({
        id: short(w.id),
        doi: w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//, "") : null,
        title: w.display_name ?? "",
        year: w.publication_year ?? null,
        pub_date: w.publication_date ?? null,
        venue: w.primary_location?.source?.display_name ?? "",
        type: w.type ?? "",
        cited_by_count: w.cited_by_count ?? 0,
        received: (w.counts_by_year ?? []).map((c: any) => ({ year: c.year, cited_by_count: c.cited_by_count ?? 0 })),
      });
    }
    cursor = (page.results?.length ?? 0) > 0 ? page.meta?.next_cursor ?? null : null;
  }
  return out;
}
