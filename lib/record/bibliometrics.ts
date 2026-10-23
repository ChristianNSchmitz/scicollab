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
      state: "ok"; citations: number; hIndex: number; i10: number; works: number; citationsThisYear: number; year: number;
      updated: string; url: string; example?: boolean;
      /** Citations received in each year, as OpenAlex reports them (recent years only). */
      countsByYear: { year: number; cited_by_count: number }[];
    }
  | { state: "no-orcid" }
  | { state: "invalid-orcid"; orcid: string }
  | { state: "pending"; orcid: string }
  | { state: "not-found"; orcid: string }
  | { state: "unreachable"; orcid: string; message?: string };

import { DEMO_PER_YEAR, DEMO_H_INDEX, DEMO_I10 } from "@/lib/record/demo-values";

export async function bibliometricsFor(userId: string, orcidRaw: string | null | undefined): Promise<Bibliometrics> {
  const raw = (orcidRaw ?? "").trim();
  if (!raw) return { state: "no-orcid" };
  const orcid = normaliseOrcid(raw);
  if (!orcid) return { state: "invalid-orcid", orcid: raw };

  const year = new Date().getFullYear();
  if (!isConfigured() && orcid === DEMO_ORCID) {
    return {
      state: "ok", citations: 412, hIndex: DEMO_H_INDEX, i10: DEMO_I10, works: 34, citationsThisYear: 57, year,
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
      citations: a.cited_by_count, hIndex: a.h_index, i10: a.i10_index ?? 0, works: a.works_count,
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
// SciCollab keeps its own dated snapshot of the total and the h-index, at
// most one a day, written by every successful sync (lib/openalex/store.ts).
// History starts at the first one.


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

// ── what changed recently ─────────────────────────────────────────────────
// For the Home dashboard: citations gained over the last 30 days, and the
// publications that arrived in that time. Both come from what the sync
// already stored, so showing them costs no OpenAlex request.

export type RecentChange = {
  gain: number | null;          // citations gained since `since`
  since: string | null;         // the snapshot day the gain is measured from
  newPubs: { openalex_id: string; title: string }[];
};

export function recentChange(
  b: Bibliometrics, snapshots: Snapshot[],
  runs: { status: string; initial: boolean; started_at: string; changes: { openalex_id: string; title: string; new?: boolean }[] }[],
  days = 30,
): RecentChange {
  if (b.state !== "ok") return { gain: null, since: null, newPubs: [] };
  const cutoff = isoDay(new Date(Date.now() - days * 864e5));
  // the last snapshot on or before the cutoff, or the oldest one we have
  const before = [...snapshots].filter((s) => s.day <= cutoff).pop() ?? snapshots[0] ?? null;
  // A snapshot from today says nothing about change; wait for history.
  const gain = before && before.day < isoDay(new Date()) ? b.citations - before.citations : null;
  const seen = new Set<string>();
  const newPubs = runs
    .filter((r) => r.status === "ok" && !r.initial && +new Date(r.started_at) >= Date.now() - days * 864e5)
    .flatMap((r) => r.changes.filter((c) => c.new))
    .filter((c) => !seen.has(c.openalex_id) && seen.add(c.openalex_id))
    .map(({ openalex_id, title }) => ({ openalex_id, title }));
  return { gain, since: gain === null ? null : before!.day, newPubs };
}
