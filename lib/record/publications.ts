import { after } from "next/server";
import { isConfigured } from "@/lib/mode";
import { isDue, syncResearcher, DEMO_ORCID, normaliseOrcid } from "@/lib/openalex/sync";
import { readAuthor, readPublications, lastRuns, type PubRow, type RunRow } from "@/lib/openalex/store";
import { examplePublications, exampleRun } from "@/lib/openalex/example";
import type { CitationProfile } from "@/lib/record/citations";

/**
 * One place that loads a researcher's synced publications, so Home, the You
 * page and the publications list always show the same numbers.
 */

export type PubSort = "new" | "cited" | "year" | "change";
export const PUB_SORTS: { key: PubSort; label: string }[] = [
  { key: "new", label: "Newest" }, { key: "cited", label: "Most cited" },
  { key: "year", label: "Cited this year" }, { key: "change", label: "Since last sync" },
];
export const pubSort = (v: string | undefined): PubSort =>
  PUB_SORTS.some((s) => s.key === v) ? (v as PubSort) : "new";

/**
 * A visit is the safety net for the scheduler: when the record is due, the
 * very first sync is awaited (briefly) so there is something to show, and
 * later overdue ones run after the response is sent.
 */
export async function syncIfDue(userId: string, orcidRaw: string | null | undefined, opts: { waitForFirst: boolean }) {
  if (!(await isDue(userId, orcidRaw))) return;
  const synced = await readAuthor(userId);
  const first = !synced || synced.orcid !== normaliseOrcid(orcidRaw);
  if (first && opts.waitForFirst) {
    await Promise.race([syncResearcher(userId, orcidRaw, "visit"), new Promise((r) => setTimeout(r, 12000))]);
  } else {
    after(() => syncResearcher(userId, orcidRaw, "visit"));
  }
}

export async function loadPublications(userId: string, orcidRaw: string | null | undefined, runCount = 10): Promise<{
  pubs: PubRow[]; runs: RunRow[]; example: boolean;
}> {
  const example = !isConfigured() && normaliseOrcid(orcidRaw) === DEMO_ORCID;
  if (example) return { pubs: examplePublications(userId), runs: [exampleRun(userId)], example };
  const [pubs, runs] = await Promise.all([readPublications(userId), lastRuns(userId, runCount)]);
  return { pubs, runs, example };
}

const byDate = (a: PubRow, b: PubRow) => (b.pub_date ?? `${b.year ?? 0}`).localeCompare(a.pub_date ?? `${a.year ?? 0}`);
const delta = (p: PubRow) => p.cited_by_count - p.prev_cited_by_count;

export function thisYearOf(p: PubRow, c: CitationProfile): number {
  return c.trend.get(p.openalex_id)?.at(-1) ?? 0;
}
export function lastYearOf(p: PubRow, c: CitationProfile): number {
  return c.trend.get(p.openalex_id)?.at(-2) ?? 0;
}

export function sortPublications(pubs: PubRow[], sort: PubSort, c: CitationProfile): PubRow[] {
  return [...pubs].sort((a, b) =>
    sort === "cited" ? b.cited_by_count - a.cited_by_count || byDate(a, b)
    : sort === "year" ? thisYearOf(b, c) - thisYearOf(a, c) || b.cited_by_count - a.cited_by_count
    : sort === "change" ? delta(b) - delta(a) || b.cited_by_count - a.cited_by_count
    : byDate(a, b));
}

/** Publications the last successful sync reported as new. */
export function newIds(runs: RunRow[], example: boolean, pubs: PubRow[]): Set<string> {
  if (example) return new Set(pubs.filter((p) => p.openalex_id === "W-example-0").map((p) => p.openalex_id));
  const last = runs.find((r) => r.status === "ok");
  if (!last || last.initial) return new Set();
  return new Set(last.changes.filter((c) => c.new).map((c) => c.openalex_id));
}

export const pubLink = (p: PubRow) =>
  p.doi ? `https://doi.org/${p.doi}` : p.openalex_id.startsWith("W-example") ? undefined : `https://openalex.org/${p.openalex_id}`;
