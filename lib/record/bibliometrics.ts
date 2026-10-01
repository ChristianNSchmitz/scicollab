import { isConfigured } from "@/lib/mode";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tables } from "@/lib/demo/store";
import { ensureRecordTables } from "@/lib/record/demo-seed";

/**
 * Citations and h-index, from OpenAlex by the researcher's ORCID.
 *
 * Nothing is computed here: both numbers are OpenAlex's own, cached for a
 * day, and shown with their source and date so they can be checked. If there
 * is no ORCID, or OpenAlex cannot be reached, the page says so instead of
 * showing a zero that would look like a fact.
 */

export type Bibliometrics =
  | {
      state: "ok"; citations: number; hIndex: number; works: number; citationsThisYear: number; year: number;
      updated: string; url: string; example?: boolean;
      /** Citations received in each year, as OpenAlex reports them (recent years only). */
      countsByYear: { year: number; cited_by_count: number }[];
    }
  | { state: "no-orcid" }
  | { state: "invalid-orcid"; orcid: string }
  | { state: "not-found"; orcid: string }
  | { state: "unreachable"; orcid: string };

const ORCID = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

/** The demo persona's ORCID is ORCID's own public test record, not a person. */
const DEMO_ORCID = "0000-0002-1825-0097";
/** Example citations per year for the demo persona, oldest first, ending this year (sum 411 of 412). */
const DEMO_PER_YEAR = [2, 6, 14, 21, 30, 38, 47, 58, 66, 72, 57];

export async function bibliometricsFor(orcidRaw: string | null | undefined): Promise<Bibliometrics> {
  const orcid = (orcidRaw ?? "").trim().replace(/^https?:\/\/orcid\.org\//, "");
  if (!orcid) return { state: "no-orcid" };
  if (!ORCID.test(orcid)) return { state: "invalid-orcid", orcid };

  const year = new Date().getFullYear();
  if (!isConfigured() && orcid === DEMO_ORCID) {
    return {
      state: "ok", citations: 412, hIndex: 11, works: 34, citationsThisYear: 57, year,
      updated: new Date().toISOString(), url: `https://orcid.org/${orcid}`, example: true,
      countsByYear: DEMO_PER_YEAR.map((n, i) => ({ year: year - DEMO_PER_YEAR.length + 1 + i, cited_by_count: n })),
    };
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
      countsByYear: (a.counts_by_year ?? []).map((c: any) => ({ year: c.year, cited_by_count: c.cited_by_count ?? 0 })),
    };
  } catch {
    return { state: "unreachable", orcid };
  }
}

// ── citation history ──────────────────────────────────────────────────────
// OpenAlex reports citations per year only. For a weekly or monthly view,
// SciCollab keeps its own dated snapshot of the total, at most one a day,
// written when the owner opens their page. History starts at the first one.


type Client = SupabaseClient<any, "public", any>;
export type Snapshot = { day: string; citations: number };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export async function saveSnapshot(supabase: Client, userId: string, b: Bibliometrics) {
  if (b.state !== "ok" || b.example) return;
  const row = { user_id: userId, day: isoDay(new Date()), citations: b.citations, h_index: b.hIndex };
  if (isConfigured()) {
    await supabase.from("citation_snapshots").upsert(row, { onConflict: "user_id,day" });
    return;
  }
  ensureRecordTables();
  const rows = tables.citation_snapshots as any[];
  const i = rows.findIndex((r) => r.user_id === userId && r.day === row.day);
  if (i >= 0) rows[i] = row; else rows.push(row);
}

export async function loadSnapshots(supabase: Client, userId: string, b: Bibliometrics): Promise<Snapshot[]> {
  if (b.state !== "ok") return [];
  if (b.example) return demoSnapshots(b);
  const { data } = await supabase.from("citation_snapshots").select("day, citations").eq("user_id", userId).order("day");
  return (data ?? []) as Snapshot[];
}

/** The demo persona's history: weekly points, consistent with its per-year counts. */
function demoSnapshots(b: Extract<Bibliometrics, { state: "ok" }>): Snapshot[] {
  const out: Snapshot[] = [];
  const now = new Date();
  for (let w = 5 * 53 + 4; w >= 0; w--) {   // a little over five years
    const d = new Date(now.getTime() - w * 7 * 864e5);
    out.push({ day: isoDay(d), citations: cumulativeAt(b, d) });
  }
  return out;
}

/** Total citations at date d, from the per-year counts, interpolated within a year. */
export function cumulativeAt(b: Extract<Bibliometrics, { state: "ok" }>, d: Date): number {
  const y = d.getFullYear();
  const after = b.countsByYear.filter((c) => c.year > y).reduce((n, c) => n + c.cited_by_count, 0);
  const atYearEnd = b.citations - after;
  const thisYear = b.countsByYear.find((c) => c.year === y)?.cited_by_count ?? 0;
  const yearStart = new Date(y, 0, 1).getTime();
  const yearEnd = y === b.year ? Date.now() : new Date(y + 1, 0, 1).getTime();
  const frac = Math.min(1, Math.max(0, (d.getTime() - yearStart) / (yearEnd - yearStart)));
  return Math.round(atYearEnd - thisYear * (1 - frac));
}
