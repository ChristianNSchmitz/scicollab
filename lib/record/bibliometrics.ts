import { isConfigured } from "@/lib/mode";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tables } from "@/lib/demo/store";
import { ensureRecordTables } from "@/lib/record/demo-seed";

import { readAuthor, lastRuns, canWrite } from "@/lib/openalex/store";
import { DEMO_ORCID, normaliseOrcid } from "@/lib/openalex/sync";

/**
 * Citations and h-index, as last synced from OpenAlex (lib/openalex/sync.ts,
 * every 12 hours). Nothing is computed here: the numbers are OpenAlex's own,
 * shown with the time of the sync. Until a first sync has succeeded the page
 * says why, instead of showing a zero that would look like a fact.
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
  | { state: "pending"; orcid: string }
  | { state: "not-found"; orcid: string }
  | { state: "unreachable"; orcid: string; message?: string };

/** Example citations per year for the demo persona, oldest first, ending this year (sum 411 of 412). */
const DEMO_PER_YEAR = [2, 6, 14, 21, 30, 38, 47, 58, 66, 72, 57];

export async function bibliometricsFor(userId: string, orcidRaw: string | null | undefined): Promise<Bibliometrics> {
  const raw = (orcidRaw ?? "").trim();
  if (!raw) return { state: "no-orcid" };
  const orcid = normaliseOrcid(raw);
  if (!orcid) return { state: "invalid-orcid", orcid: raw };

  const year = new Date().getFullYear();
  if (!isConfigured() && orcid === DEMO_ORCID) {
    return {
      state: "ok", citations: 412, hIndex: 11, works: 34, citationsThisYear: 57, year,
      updated: new Date().toISOString(), url: `https://orcid.org/${orcid}`, example: true,
      countsByYear: DEMO_PER_YEAR.map((n, i) => ({ year: year - DEMO_PER_YEAR.length + 1 + i, cited_by_count: n })),
    };
  }

  const can = canWrite();
  if (!can.ok) return { state: "unreachable", orcid, message: can.reason };

  const a = await readAuthor(userId);
  if (a && a.orcid === orcid) {
    return {
      state: "ok",
      citations: a.cited_by_count, hIndex: a.h_index, works: a.works_count,
      citationsThisYear: a.counts_by_year.find((c) => c.year === year)?.cited_by_count ?? 0,
      year, updated: a.synced_at, url: `https://openalex.org/${a.openalex_id}`,
      countsByYear: a.counts_by_year.map((c) => ({ year: c.year, cited_by_count: c.cited_by_count })),
    };
  }
  const [run] = await lastRuns(userId, 1);
  if (!run || run.status === "running" || run.status === "ok") return { state: "pending", orcid };
  if (run.status === "not-found") return { state: "not-found", orcid };
  return { state: "unreachable", orcid, message: run.error ?? undefined };
}

// ── citation history ──────────────────────────────────────────────────────
// OpenAlex reports citations per year only. For a weekly or monthly view,
// SciCollab keeps its own dated snapshot of the total, at most one a day,
// written when the owner opens their page. History starts at the first one.


type Client = SupabaseClient<any, "public", any>;
export type Snapshot = { day: string; citations: number };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

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
